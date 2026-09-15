UPDATE tracked_tokens SET
  m8_at    = (SELECT s.sampled_at FROM token_samples s WHERE s.token_address=tracked_tokens.address AND s.minutes_since_call>=480  ORDER BY s.minutes_since_call ASC LIMIT 1),
  m8_price = (SELECT s.price      FROM token_samples s WHERE s.token_address=tracked_tokens.address AND s.minutes_since_call>=480  ORDER BY s.minutes_since_call ASC LIMIT 1),
  m8_mcap  = (SELECT s.mcap       FROM token_samples s WHERE s.token_address=tracked_tokens.address AND s.minutes_since_call>=480  ORDER BY s.minutes_since_call ASC LIMIT 1),
  m8_liq   = (SELECT s.liquidity  FROM token_samples s WHERE s.token_address=tracked_tokens.address AND s.minutes_since_call>=480  ORDER BY s.minutes_since_call ASC LIMIT 1),
  m8_vol_h1= (SELECT s.volume_h1  FROM token_samples s WHERE s.token_address=tracked_tokens.address AND s.minutes_since_call>=480  ORDER BY s.minutes_since_call ASC LIMIT 1)
WHERE m8_at IS NULL;

UPDATE tracked_tokens SET
  m16_at    = (SELECT s.sampled_at FROM token_samples s WHERE s.token_address=tracked_tokens.address AND s.minutes_since_call>=960 ORDER BY s.minutes_since_call ASC LIMIT 1),
  m16_price = (SELECT s.price      FROM token_samples s WHERE s.token_address=tracked_tokens.address AND s.minutes_since_call>=960 ORDER BY s.minutes_since_call ASC LIMIT 1),
  m16_mcap  = (SELECT s.mcap       FROM token_samples s WHERE s.token_address=tracked_tokens.address AND s.minutes_since_call>=960 ORDER BY s.minutes_since_call ASC LIMIT 1),
  m16_liq   = (SELECT s.liquidity  FROM token_samples s WHERE s.token_address=tracked_tokens.address AND s.minutes_since_call>=960 ORDER BY s.minutes_since_call ASC LIMIT 1),
  m16_vol_h1= (SELECT s.volume_h1  FROM token_samples s WHERE s.token_address=tracked_tokens.address AND s.minutes_since_call>=960 ORDER BY s.minutes_since_call ASC LIMIT 1)
WHERE m16_at IS NULL;

UPDATE tracked_tokens SET
  m24_at    = (SELECT s.sampled_at FROM token_samples s WHERE s.token_address=tracked_tokens.address AND s.minutes_since_call>=1440 ORDER BY s.minutes_since_call ASC LIMIT 1),
  m24_price = (SELECT s.price      FROM token_samples s WHERE s.token_address=tracked_tokens.address AND s.minutes_since_call>=1440 ORDER BY s.minutes_since_call ASC LIMIT 1),
  m24_mcap  = (SELECT s.mcap       FROM token_samples s WHERE s.token_address=tracked_tokens.address AND s.minutes_since_call>=1440 ORDER BY s.minutes_since_call ASC LIMIT 1),
  m24_liq   = (SELECT s.liquidity  FROM token_samples s WHERE s.token_address=tracked_tokens.address AND s.minutes_since_call>=1440 ORDER BY s.minutes_since_call ASC LIMIT 1),
  m24_vol_h1= (SELECT s.volume_h1  FROM token_samples s WHERE s.token_address=tracked_tokens.address AND s.minutes_since_call>=1440 ORDER BY s.minutes_since_call ASC LIMIT 1)
WHERE m24_at IS NULL;

UPDATE tracked_tokens SET m8_mult  = m8_price  / call_price WHERE m8_mult  IS NULL AND m8_price  IS NOT NULL AND call_price > 0;
UPDATE tracked_tokens SET m16_mult = m16_price / call_price WHERE m16_mult IS NULL AND m16_price IS NOT NULL AND call_price > 0;
UPDATE tracked_tokens SET m24_mult = m24_price / call_price WHERE m24_mult IS NULL AND m24_price IS NOT NULL AND call_price > 0;
