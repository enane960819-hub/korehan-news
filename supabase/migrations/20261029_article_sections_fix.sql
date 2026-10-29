-- auto-apply
-- 2026-10-29 sweep: articles filed under the wrong section.
-- The admin CMS mapped IT과학/tech → 'beauty' when it opened and re-saved
-- an article (normalizeNewsSection), so most of 'beauty' is tech/science
-- and IT과학 had 2 rows. Each id below was reviewed by title. Only rows
-- still in the old section are touched, so re-running is a no-op and a
-- later manual change is never overwritten.

-- Tech & science
update public.articles set section = 'IT과학', updated_at = now()
 where section = 'beauty' and id in (
  'mvro819d007f','mv76qqjq45cf','mv2wewmfsprr','mv2csyyoaeqr','mpbuhhnyspdl','mp5jf5leoimb',
  'mozwk91yd860','moyxs1tnbrs5','mowq59qac7z9','mosfnmdkya16','mor0x3udjeta','moqehhca9gnx',
  'moqegtat5l47','moqeg6dntikf','mon2iizudae8','mon2hcszzx2y','mom3tlzswxz4','molixcm2wukl',
  'moknthahfb0g','mof6eofsser5','moelcki5bw68','moelbxqrojeg','mocf3156w1ma','mob0bzqrsnvj',
  'moamhg2arz55','mo997g4atuzs','mo7tte2sq1zd','mo7tqmqeimvc','mo7tpkb6fqr5','mo4a58z1il29',
  'mo1fxedxwqhn','mnobwosddkvk','mnix0c5b1d97','mniwzglxp014','mniwyj250jn4','mmfavwhbx3gl',
  'mme1it9jthdk','mmdzsen0c2vv','mofqq2fftt3n','moi5ka4oq7cz');

-- Animals / nature
update public.articles set section = 'nature', updated_at = now()
 where section = 'beauty' and id in (
  'mozuxjqffd9m','moliygnypvia','mogeoe04bzt8','moeg4nn7youv','mocf3l034hvc');

-- Society
update public.articles set section = '사회', updated_at = now()
 where section = 'beauty' and id in ('mogepo38afq2','mof6grzq6oc1');
update public.articles set section = '사회', updated_at = now()
 where section = 'crime' and id = 'mpg4bp2fcj1w';

-- World
update public.articles set section = '국제', updated_at = now()
 where section = 'beauty' and id in ('mortmxn5ubv7','mo5sa7hlo7ta','mmivyelwpb4w','mo7trf618ddd');

-- Culture (sports story, video game)
update public.articles set section = '문화', updated_at = now()
 where section = 'beauty' and id in ('mor0wfixgfqn','mogelevkadtk');

-- '해외연예' has no nav entry of its own; the Entertainment page reads '연예'.
update public.articles set section = '연예', updated_at = now()
 where section = '해외연예';

-- Seed/demo rows from the first build (one-line bodies, made-up news such
-- as "BTS 월드투어 전석 매진"). Unpublish — kept as drafts, not deleted.
update public.articles set status = 'draft', updated_at = now()
 where id in ('s8','s9','s10','s11','s14') and status = 'published';
