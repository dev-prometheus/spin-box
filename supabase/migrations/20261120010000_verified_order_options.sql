BEGIN;

ALTER TABLE public.temu_products ADD COLUMN verified_variants jsonb;
ALTER TABLE public.paid_rounds ADD COLUMN order_selection jsonb;
ALTER TABLE public.game_spins ADD COLUMN order_selection jsonb;

REVOKE EXECUTE ON FUNCTION public.play_paid_round(uuid, uuid, uuid, numeric, numeric)
    FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.play_paid_round(
    p_request_id uuid,
    p_round_id uuid,
    p_product_id uuid,
    p_expected_price_usd numeric,
    p_stake_usd numeric,
    p_variant_id text,
    p_quantity integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_balance numeric;
    v_product public.temu_products;
    v_round public.paid_rounds;
    v_spin public.game_spins;
    v_title text := 'Welcome Starter Item';
    v_price numeric := 2;
    v_image text;
    v_variant jsonb;
    v_selection jsonb;
    v_max_price numeric;
    v_debit numeric := 0;
    v_roll double precision;
    v_outcome text;
BEGIN
    IF v_user_id IS NULL OR p_request_id IS NULL THEN
        RAISE EXCEPTION 'Sign in to play.';
    END IF;

    -- Share the wallet row lock used by withdrawal and other balance mutations.
    SELECT account_credits INTO v_balance FROM public.users WHERE id = v_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet unavailable.';
    END IF;

    SELECT * INTO v_spin FROM public.game_spins
    WHERE user_id = v_user_id AND paid_request_id = p_request_id;

    IF NOT FOUND THEN
        SELECT * INTO v_round FROM public.paid_rounds
        WHERE user_id = v_user_id AND status = 'RETRY';

        IF p_round_id IS DISTINCT FROM v_round.id THEN
            RAISE EXCEPTION 'Round changed. Reload to continue.';
        END IF;

        IF v_round.id IS NULL THEN
            IF p_stake_usd IS NULL OR p_stake_usd NOT BETWEEN 1 AND 99999999.99
                OR p_stake_usd <> round(p_stake_usd, 2) THEN
                RAISE EXCEPTION 'Enter a stake of at least $1.00 USD, with up to two decimal places.';
            END IF;

            IF p_product_id IS NOT NULL THEN
                SELECT * INTO v_product FROM public.temu_products WHERE id = p_product_id FOR SHARE;
                IF NOT FOUND OR v_product.in_stock IS NOT TRUE
                    OR v_product.updated_at IS NULL OR v_product.updated_at <= now() - interval '15 minutes' THEN
                    RAISE EXCEPTION 'Item price or availability changed. Check the item again.';
                END IF;
                SELECT entry INTO v_variant FROM jsonb_array_elements(v_product.verified_variants) AS items(entry)
                  WHERE entry->>'id' = p_variant_id;
                IF NOT FOUND OR p_quantity IS NULL
                    OR p_quantity NOT BETWEEN 1 AND (v_variant->>'maxQuantity')::integer THEN
                    RAISE EXCEPTION 'This option or quantity could not be verified. Check the item again.';
                END IF;
                v_price := (v_variant->>'priceUsd')::numeric * p_quantity;
                IF v_price NOT BETWEEN 0.01 AND 99999999.99 OR v_price IS DISTINCT FROM p_expected_price_usd THEN
                    RAISE EXCEPTION 'Item price or availability changed. Check the item again.';
                END IF;
                v_title := v_product.title;
                v_image := v_product.image_url;
                v_selection := jsonb_build_object('variantId', p_variant_id, 'quantity', p_quantity,
                    'options', v_variant->'options', 'unitPriceUsd', v_variant->'priceUsd', 'url', v_product.product_url);
            ELSIF p_expected_price_usd IS DISTINCT FROM v_price OR p_stake_usd <> 1
                OR p_variant_id IS NOT NULL OR p_quantity IS DISTINCT FROM 1 THEN
                RAISE EXCEPTION 'The starter item uses a $1.00 USD stake.';
            END IF;

            v_max_price := p_stake_usd * CASE WHEN p_stake_usd >= 101 THEN 7 WHEN p_stake_usd >= 5 THEN 5 ELSE 2 END;
            IF v_price > v_max_price THEN
                RAISE EXCEPTION 'The stake is too low for this item.';
            END IF;
            IF v_balance < p_stake_usd THEN
                RAISE EXCEPTION 'Your wallet balance is too low for this stake.';
            END IF;

            v_debit := p_stake_usd;
            UPDATE public.users SET account_credits = account_credits - v_debit, updated_at = now()
                WHERE id = v_user_id RETURNING account_credits INTO v_balance;
            INSERT INTO public.paid_rounds (user_id, product_id, product_title, retail_value_usd, image_url, stake_usd, status, order_selection)
                VALUES (v_user_id, p_product_id, v_title, v_price, v_image, p_stake_usd, 'RETRY', v_selection)
                RETURNING * INTO v_round;
        END IF;

        -- Preserve the existing paid-wheel distribution.
        v_roll := random();
        v_outcome := CASE WHEN v_roll < 0.22 THEN 'WIN' WHEN v_roll < 0.50 THEN 'TRY_AGAIN' ELSE 'LOSE' END;

        IF v_outcome <> 'TRY_AGAIN' THEN
            UPDATE public.paid_rounds SET status = v_outcome
                WHERE id = v_round.id RETURNING * INTO v_round;
        END IF;

        INSERT INTO public.game_spins (
            user_id, product_id, spin_cost_credits, outcome, product_title, retail_value_usd,
            paid_round_id, paid_request_id, wallet_debit_usd, order_selection
        ) VALUES (
            v_user_id, v_round.product_id, CASE WHEN v_outcome = 'TRY_AGAIN' THEN 0 ELSE v_round.stake_usd END,
            v_outcome, v_round.product_title, v_round.retail_value_usd, v_round.id, p_request_id, v_debit, v_round.order_selection
        ) RETURNING * INTO v_spin;
    ELSE
        SELECT * INTO v_round FROM public.paid_rounds WHERE id = v_spin.paid_round_id;
    END IF;

    RETURN jsonb_build_object(
        'outcome', v_spin.outcome,
        'account_credits', v_balance,
        'spin_record', to_jsonb(v_spin),
        'round', to_jsonb(v_round)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.play_paid_round(uuid, uuid, uuid, numeric, numeric, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.play_paid_round(uuid, uuid, uuid, numeric, numeric, text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_spin_shipping(
    p_spin_id UUID,
    p_attributes JSONB,
    p_shipping JSONB
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_spin RECORD;
BEGIN
    SELECT * INTO v_spin
    FROM public.game_spins
    WHERE id = p_spin_id AND user_id = auth.uid()
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Spin record not found or unauthorized.';
    END IF;

    IF v_spin.outcome != 'WIN' THEN
        RAISE EXCEPTION 'Only winning spins qualify for fulfillment.';
    END IF;

    IF v_spin.fulfillment_choice IS NOT NULL THEN
        RAISE EXCEPTION 'This win has already been claimed.';
    END IF;

    IF v_spin.retail_value_usd < 33.00 THEN
        RAISE EXCEPTION 'Products under $33.00 are only eligible for 50%% instant cash liquidation.';
    END IF;

    UPDATE public.game_spins
    SET fulfillment_choice = 'SHIPPED',
        product_attributes = coalesce(v_spin.order_selection, p_attributes),
        shipping_details = p_shipping,
        shipping_status = 'PENDING'
    WHERE id = p_spin_id;

    RETURN TRUE;
END;
$$;

ALTER TABLE public.game_spins ADD COLUMN liquidation_reason text;

CREATE FUNCTION public.pay_unavailable_spin(p_admin_id uuid, p_spin_id uuid, p_reason text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_spin public.game_spins;
    v_payout numeric;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_admin_id AND is_admin IS TRUE) THEN
        RAISE EXCEPTION 'Admin access required.' USING ERRCODE = '42501';
    END IF;
    IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 500 THEN
        RAISE EXCEPTION 'Enter a payout reason.';
    END IF;
    SELECT * INTO v_spin FROM public.game_spins WHERE id = p_spin_id FOR UPDATE;
    IF NOT FOUND OR v_spin.outcome IS DISTINCT FROM 'WIN'
        OR v_spin.fulfillment_choice IS DISTINCT FROM 'SHIPPED'
        OR v_spin.shipping_status IS NULL OR v_spin.shipping_status NOT IN ('PENDING', 'PROCESSING')
        OR v_spin.tracking_number IS NOT NULL OR v_spin.retail_value_usd IS NULL
        OR v_spin.retail_value_usd NOT BETWEEN 0.01 AND 99999999.99 THEN
        RAISE EXCEPTION 'This order cannot be paid out.' USING ERRCODE = 'P0002';
    END IF;
    v_payout := round(v_spin.retail_value_usd * 0.50, 2);
    UPDATE public.game_spins SET fulfillment_choice = 'LIQUIDATED', shipping_status = 'NOT_APPLICABLE',
        liquidation_cash_usd = v_payout, liquidation_reason = btrim(p_reason) WHERE id = p_spin_id;
    UPDATE public.users SET account_credits = coalesce(account_credits, 0) + v_payout, updated_at = now()
        WHERE id = v_spin.user_id;
    INSERT INTO public.admin_audit_logs(admin_id, action_type, target_id, metadata)
        VALUES (p_admin_id, 'PAY_UNAVAILABLE_ORDER', p_spin_id, jsonb_build_object('payoutUsd', v_payout, 'reason', btrim(p_reason)));
    RETURN v_payout;
END;
$$;
REVOKE ALL ON FUNCTION public.pay_unavailable_spin(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pay_unavailable_spin(uuid, uuid, text) TO service_role;
COMMIT;
