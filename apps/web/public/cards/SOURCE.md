# Playing-card asset provenance

The 52 face SVGs in this directory were vendored from
[`hayeah/playing-cards-assets`](https://github.com/hayeah/playing-cards-assets)
at commit `1e4497c05c3da9956c9f517bd386e9a7090ff7fa`.

The upstream repository distributes the assets under the MIT License and
credits the public-domain Vector Playing Cards project. The complete upstream
license is preserved in `LICENSE.txt`.

TrueEdge renames the files to `{rank}{suit}.svg` (`AS.svg`, `10H.svg`, and so
on). Jack, queen, and king faces use the upstream `simple/` variants. A scan at
vendoring time found no script elements, JavaScript URLs, or external image
references. Internal fragment references used by the SVG drawings are kept.

`back.svg` is an original TrueEdge presentation asset and is not sourced from
the upstream deck.
