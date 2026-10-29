-- auto-apply
-- Shop copy fixes (2026-10-29 learner audit). Idempotent: plain UPDATEs by id.
-- * The postcard is an in-app gift — nothing is mailed; "real handwritten"
--   read like a physical item.
-- * Yuja *is* citron, so "yuja, omija, citron" listed one tea twice.
update public.shop_items
   set name = 'Thank-You Postcard',
       description = 'A digital thank-you postcard for the reporter — an in-app gift, nothing is mailed.'
 where id = 'reporter_postcard';

update public.shop_items
   set description = 'Yuja, omija, barley — pick a tea, send warmth.'
 where id = 'reporter_korean_tea';
