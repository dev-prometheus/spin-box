BEGIN;

CREATE FUNCTION public.get_recent_activity()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    WITH events AS (
        SELECT 'win'::text AS kind, s.id AS event_id,
            s.retail_value_usd AS amount_usd, s.created_at AS occurred_at
        FROM public.game_spins AS s
        WHERE s.outcome = 'WIN' AND s.paid_round_id IS NOT NULL
          AND s.retail_value_usd BETWEEN 0.01 AND 99999999.99
          AND s.created_at >= now() - interval '24 hours'
          AND s.created_at <= now() - interval '5 minutes'
        UNION ALL
        SELECT 'cashout', w.id, w.amount_usd, completion.occurred_at
        FROM public.withdrawals AS w
        JOIN (
            SELECT target_id, max(created_at) AS occurred_at
            FROM public.admin_audit_logs
            WHERE action_type = 'COMPLETE_WITHDRAWAL'
              AND created_at >= now() - interval '24 hours'
            GROUP BY target_id
        ) AS completion ON completion.target_id::text = w.id::text
        WHERE w.status = 'COMPLETED' AND w.tx_hash IS NOT NULL
          AND w.amount_usd BETWEEN 0.01 AND 9999999999.99
          AND completion.occurred_at <= now() - interval '5 minutes'
    )
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', encode(sha256(convert_to(kind || ':' || event_id::text, 'UTF8')), 'hex'),
        'kind', kind,
        'amountUsd', amount_usd
    ) ORDER BY occurred_at DESC, kind, event_id), '[]'::jsonb)
    FROM (
        SELECT * FROM events ORDER BY occurred_at DESC, kind, event_id LIMIT 6
    ) AS recent;
$$;

REVOKE ALL ON FUNCTION public.get_recent_activity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_recent_activity() TO anon, authenticated;

COMMIT;
