# Phrase illustrations (Lottie)

The Today's Phrase reader (`korehan-phrase.html`) renders an animated
Lottie illustration in the corner of the Meaning card when a JSON file
exists at one of the paths below. When no JSON is found it falls back
to a high-quality SVG icon (Iconify Fluent Emoji), so this folder can
stay empty without breaking anything.

## How to add a new animation

1. Find a free animation on https://lottiefiles.com/ (filter by free
   license — most "Featured" picks under "Animated icons" work).
2. Hit **Download → Lottie JSON**, save it as the matching filename
   below.
3. Drop the file into this folder and redeploy.
4. The reader probes each path with a `HEAD` request, swaps the
   Iconify fallback for the Lottie player on success, and caches the
   probe result for the page session.

## Paths the reader expects

| Filename            | Triggers when phrase mentions                       |
| ------------------- | ---------------------------------------------------- |
| `lamp.json`         | 등잔, 램프, 불빛, 등불, lamp, light                   |
| `mountain.json`     | 태산, 산, mountain, hill, peak                       |
| `sunrise.json`      | 낙, 행복, happy, joy, reward, sunrise, 일출          |
| `rocket.json`       | 시작, 첫걸음, begin, start, launch                   |
| `eye.json`          | 백문, 보다, see, sight, eye, 관찰                    |
| `sparkle.json`      | 티끌, 먼지, dust, drop, 작은, tiny, small             |
| `bird.json`         | 꿩, 일석이조, 두 마리, bird                           |
| `cow.json`          | 소, cow, stable, barn, 황소                          |
| `tiger.json`        | 호랑이, 범, tiger                                    |
| `horse.json`        | 말, 마이, horse, gallop                              |
| `dog.json`          | 개, 강아지, dog                                      |
| `water.json`        | 물, 강, river, water, stream                         |
| `flower.json`       | 꽃, 꽃밭, flower, blossom, 핀                        |
| `tree.json`         | 나무, tree, 숲, forest, woods                        |
| `book.json`         | 책, 글, read, word, book, 문장                       |
| `clock.json`        | 시간, 세월, time, hour, clock                        |
| `coin.json`         | 돈, 금, wealth, money, gold, 부자                    |
| `fire.json`         | 불, 불꽃, fire, flame, burn                          |
| `wind.json`         | 바람, wind, breeze                                   |
| `rain.json`         | 비, rain, shower, 폭우                               |
| `snow.json`         | 눈, snow, winter, 겨울                               |
| `sun.json`          | 해, sun, 볕, 햇살                                    |
| `moon.json`         | 달, moon, 밤, night                                  |
| `road.json`         | 길, road, path, 여정                                 |
| `hand.json`         | 손, hand, 손길                                       |
| `friends.json`      | 친구, friend, 벗                                     |
| `speech.json`       | 입, 말씀, word, speak, talk                          |

The full mapping (with regex specifics) lives in `PHRASE_ILLUS_MAP`
inside `korehan-phrase.html`.

## Want to add a new keyword?

Edit `PHRASE_ILLUS_MAP` in `korehan-phrase.html` — add a new entry
with `{ rx, lottie, icon, fallback }`. The Iconify icon picker is
https://icon-sets.iconify.design/?category=Emojis (search the
`fluent-emoji-flat` set for color SVG icons that look like
illustrations).
