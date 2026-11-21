BEGIN;

CREATE TABLE public.paid_quote_draws (
    user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    small_cap integer NOT NULL CHECK (small_cap BETWEEN 3 AND 4),
    large_cap integer NOT NULL CHECK (large_cap BETWEEN 3 AND 6)
);
ALTER TABLE public.paid_quote_draws ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.paid_quote_draws FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.get_paid_quote(p_stake_usd numeric, p_order_usd numeric)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_user uuid := auth.uid();
    v_draw public.paid_quote_draws;
    v_min numeric;
    v_max numeric;
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'Sign in to get a quote.';
    END IF;
    IF (p_stake_usd IS NULL) = (p_order_usd IS NULL)
        OR (p_stake_usd IS NOT NULL AND (
            p_stake_usd NOT BETWEEN 1 AND 99999999.99 OR p_stake_usd <> round(p_stake_usd, 2)
        ))
        OR (p_order_usd IS NOT NULL AND (
            p_order_usd NOT BETWEEN 3 AND 99999999.99 OR p_order_usd <> round(p_order_usd, 2)
        )) THEN
        RAISE EXCEPTION 'Enter a valid stake (at least $1) or order total (at least $3).';
    END IF;

    PERFORM 1 FROM public.users WHERE id = v_user FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet unavailable.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.paid_rounds WHERE user_id = v_user AND status = 'RETRY') THEN
        RAISE EXCEPTION 'Finish your reserved round first.';
    END IF;
    SELECT * INTO v_draw FROM public.paid_quote_draws WHERE user_id = v_user;
    IF NOT FOUND THEN
        INSERT INTO public.paid_quote_draws (user_id, small_cap, large_cap)
        VALUES (v_user, 3 + floor(random() * 2)::integer, 3 + floor(random() * 4)::integer)
        RETURNING * INTO v_draw;
    END IF;

    IF p_order_usd IS NOT NULL THEN
        v_min := greatest(1, ceil(100 * p_order_usd /
            CASE WHEN p_order_usd <= 10 THEN v_draw.small_cap ELSE v_draw.large_cap END) / 100);
        v_max := floor(100 * p_order_usd / 3) / 100;
        IF v_min > v_max THEN
            RAISE EXCEPTION 'This order has no eligible stake in whole cents. Try a different item or quantity.';
        END IF;
        RETURN jsonb_build_object('id', v_draw.id, 'min', v_min, 'max', v_max);
    END IF;

    v_min := p_stake_usd * 3;
    IF v_min > 99999999.99 THEN
        RAISE EXCEPTION 'Enter a lower stake.';
    END IF;
    RETURN jsonb_build_object('id', v_draw.id, 'ranges', (
        SELECT jsonb_agg(jsonb_build_object('min', limits.low, 'max', limits.high) ORDER BY limits.low)
        FROM (VALUES
            (v_min, least(10, p_stake_usd * v_draw.small_cap)),
            (greatest(10.01, v_min), least(99999999.99, p_stake_usd * v_draw.large_cap))
        ) AS limits(low, high)
        WHERE limits.low <= limits.high
    ));
END;
$$;

REVOKE ALL ON FUNCTION public.get_paid_quote(numeric, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_paid_quote(numeric, numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.play_paid_round(uuid, uuid, uuid, numeric, numeric, text, integer)
    FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.play_paid_round(
    p_request_id uuid,
    p_round_id uuid,
    p_product_id uuid,
    p_expected_price_usd numeric,
    p_stake_usd numeric,
    p_variant_id text,
    p_quantity integer,
    p_quote_id uuid
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
    v_quote public.paid_quote_draws;
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

            IF p_product_id IS NOT NULL THEN
                SELECT * INTO v_quote FROM public.paid_quote_draws
                WHERE user_id = v_user_id AND id = p_quote_id;
                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Your quote changed. Get a new quote before spinning.';
                END IF;
                IF v_price < p_stake_usd * 3 OR v_price > p_stake_usd *
                    (CASE WHEN v_price <= 10 THEN v_quote.small_cap ELSE v_quote.large_cap END) THEN
                    RAISE EXCEPTION 'The item and stake are outside your quote range.';
                END IF;
                DELETE FROM public.paid_quote_draws WHERE id = v_quote.id;
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

REVOKE ALL ON FUNCTION public.play_paid_round(uuid, uuid, uuid, numeric, numeric, text, integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.play_paid_round(uuid, uuid, uuid, numeric, numeric, text, integer, uuid) TO authenticated;

COMMIT;
