BEGIN;

ALTER TABLE public.withdrawals
    ADD COLUMN payout_units text,
    ADD COLUMN payout_decimals integer,
    ADD COLUMN payout_quoted_at timestamptz,
    ADD COLUMN rejection_reason text;

CREATE FUNCTION public.settle_crypto_withdrawal(
    p_admin_id uuid, p_id uuid, p_action text, p_units text DEFAULT NULL,
    p_decimals integer DEFAULT NULL, p_tx_hash text DEFAULT NULL, p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_row public.withdrawals;
    v_action text;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_admin_id AND is_admin IS TRUE) THEN
        RAISE EXCEPTION 'Admin access required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_row FROM public.withdrawals WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Withdrawal unavailable.' USING ERRCODE = 'P0002';
    END IF;

    CASE p_action
    WHEN 'PREPARE' THEN
        IF v_row.status = 'PROCESSING' AND v_row.payout_units IS NOT NULL THEN
            RETURN to_jsonb(v_row) || '{"changed": false}'::jsonb;
        END IF;
        IF v_row.status IS DISTINCT FROM 'PENDING' OR v_row.tx_hash IS NOT NULL
            OR p_units IS NULL OR p_units !~ '^[1-9][0-9]{0,31}$'
            OR p_decimals IS NULL OR p_decimals NOT BETWEEN 0 AND 18 THEN
            RAISE EXCEPTION 'Withdrawal cannot be prepared.' USING ERRCODE = 'P0002';
        END IF;
        UPDATE public.withdrawals SET status = 'PROCESSING', payout_units = p_units,
            payout_decimals = p_decimals, payout_quoted_at = now() WHERE id = p_id RETURNING * INTO v_row;
        v_action := 'PREPARE_WITHDRAWAL';
    WHEN 'COMPLETE' THEN
        IF v_row.status = 'COMPLETED' AND v_row.tx_hash = p_tx_hash THEN
            RETURN to_jsonb(v_row) || '{"changed": false}'::jsonb;
        END IF;
        IF v_row.status IS DISTINCT FROM 'PROCESSING' OR v_row.payout_units IS NULL
            OR v_row.payout_units IS DISTINCT FROM p_units OR v_row.payout_decimals IS DISTINCT FROM p_decimals
            OR p_tx_hash IS NULL OR length(p_tx_hash) NOT BETWEEN 16 AND 128 THEN
            RAISE EXCEPTION 'Withdrawal cannot be completed.' USING ERRCODE = 'P0002';
        END IF;
        PERFORM pg_advisory_xact_lock(hashtextextended(v_row.chain || ':' || p_tx_hash, 0));
        IF EXISTS (
            SELECT 1 FROM public.withdrawals w WHERE w.id <> p_id AND w.chain = v_row.chain
              AND CASE
                WHEN w.chain = 'SOL' THEN w.tx_hash = p_tx_hash
                WHEN w.chain = 'ETH' THEN regexp_replace(lower(w.tx_hash), '^0x', '') = substring(p_tx_hash FROM 3)
                ELSE regexp_replace(lower(w.tx_hash), '^0x', '') = p_tx_hash
              END
        ) THEN
            RAISE EXCEPTION 'This transaction is already linked to another withdrawal.' USING ERRCODE = '23505';
        END IF;
        UPDATE public.withdrawals SET status = 'COMPLETED', tx_hash = p_tx_hash
            WHERE id = p_id RETURNING * INTO v_row;
        v_action := 'COMPLETE_WITHDRAWAL';
    WHEN 'REJECT' THEN
        IF v_row.status = 'REJECTED' THEN
            RETURN to_jsonb(v_row) || '{"changed": false}'::jsonb;
        END IF;
        IF v_row.status IS DISTINCT FROM 'PENDING' OR v_row.tx_hash IS NOT NULL
            OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 500
            OR v_row.amount_usd IS NULL OR v_row.amount_usd NOT BETWEEN 5 AND 9999999999.99
            OR v_row.source_ledger NOT IN ('ACCOUNT_CREDITS', 'REFERRAL_BALANCE') THEN
            RAISE EXCEPTION 'Only unpaid, unprepared requests can be refunded.' USING ERRCODE = 'P0002';
        END IF;
        IF v_row.source_ledger = 'ACCOUNT_CREDITS' THEN
            UPDATE public.users SET account_credits = account_credits + v_row.amount_usd, updated_at = now()
                WHERE id = v_row.user_id;
        ELSE
            UPDATE public.users SET referral_balance = referral_balance + v_row.amount_usd, updated_at = now()
                WHERE id = v_row.user_id;
        END IF;
        UPDATE public.withdrawals SET status = 'REJECTED', rejection_reason = btrim(p_reason)
            WHERE id = p_id RETURNING * INTO v_row;
        v_action := 'REJECT_WITHDRAWAL';
    ELSE
        RAISE EXCEPTION 'Unsupported withdrawal action.';
    END CASE;

    INSERT INTO public.admin_audit_logs(admin_id, action_type, target_id, metadata)
    VALUES (p_admin_id, v_action, p_id, jsonb_strip_nulls(jsonb_build_object(
        'amountUsd', v_row.amount_usd, 'source', v_row.source_ledger, 'payoutUnits', v_row.payout_units,
        'payoutDecimals', v_row.payout_decimals, 'txHash', v_row.tx_hash, 'reason', v_row.rejection_reason
    )));
    RETURN to_jsonb(v_row) || '{"changed": true}'::jsonb;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_crypto_withdrawal(uuid, uuid, text, text, integer, text, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_crypto_withdrawal(uuid, uuid, text, text, integer, text, text)
    TO service_role;

ALTER FUNCTION public.request_crypto_withdrawal(text, text, text, text, numeric)
    RENAME TO debit_crypto_withdrawal_internal;
REVOKE ALL ON FUNCTION public.debit_crypto_withdrawal_internal(text, text, text, text, numeric)
    FROM PUBLIC, anon, authenticated, service_role;
ALTER FUNCTION public.debit_crypto_withdrawal_internal(text, text, text, text, numeric)
    SET search_path = '';

CREATE FUNCTION public.request_crypto_withdrawal(
    p_source_ledger text, p_chain text, p_asset text, p_destination_address text, p_amount_usd numeric
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_destination text := btrim(p_destination_address);
    v_pattern text;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sign in to request a withdrawal.';
    END IF;
    IF p_amount_usd IS NULL OR p_amount_usd NOT BETWEEN 5 AND 9999999999.99
        OR p_amount_usd <> round(p_amount_usd, 2) THEN
        RAISE EXCEPTION 'Enter at least $5.00 USD, with up to two decimal places.';
    END IF;

    v_pattern := CASE p_chain || ':' || p_asset
        WHEN 'ETH:USDT' THEN '^0x[0-9a-fA-F]{40}$'
        WHEN 'TRX:USDT' THEN '^T[1-9A-HJ-NP-Za-km-z]{33}$'
        WHEN 'TRX:TRX' THEN '^T[1-9A-HJ-NP-Za-km-z]{33}$'
        WHEN 'SOL:SOL' THEN '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
        WHEN 'SOL:USDC' THEN '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
        WHEN 'BTC:BTC' THEN '^(bc1[ac-hj-np-z02-9]{11,87}|BC1[AC-HJ-NP-Z02-9]{11,87}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$'
    END;
    IF v_pattern IS NULL OR v_destination IS NULL OR v_destination !~ v_pattern THEN
        RAISE EXCEPTION 'Check the destination address, asset and network.';
    END IF;

    RETURN public.debit_crypto_withdrawal_internal(
        p_source_ledger, p_chain, p_asset, v_destination, p_amount_usd
    );
END;
$$;

REVOKE ALL ON FUNCTION public.request_crypto_withdrawal(text, text, text, text, numeric)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_crypto_withdrawal(text, text, text, text, numeric)
    TO authenticated;

COMMIT;
