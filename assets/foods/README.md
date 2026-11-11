# Ingredient photos

Put one photo per ingredient here, named after its id in `src/data/foods.ts`
(`potato.jpg`, `cucumber.jpg`, `mincedbeef.jpg`, ...), then run `npm run food-images`.

- Landscape 4:3, about 800 x 600 px, JPG, under 100 KB each.
- Only photos you may use commercially: your own, or from a free stock library.
  Keep a note of where each one came from.
- `npm run food-images -- --missing` lists the ingredients that still have no photo.

The app shows these on each cooking step that mentions the ingredient, and as the cover
of a recipe that has no photo of its own.
