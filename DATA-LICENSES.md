# Data Licenses

Terminal-Sigma bundles nutrition and exercise data from public sources whose terms allow redistribution inside an MIT package. Each source below names where its data lives and what its license asks for:

| Source                                                                                | License                                                                     | Used In                                                       |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [2024 Adult Compendium of Physical Activities](https://pacompendium.com/)             | Free to use with the citation below, values unchanged                       | The MET values in `source/exercises.ts`                       |
| [USDA FoodData Central, FNDDS 2021-2023](https://fdc.nal.usda.gov/download-datasets/) | [CC0 1.0](https://catalog.data.gov/dataset/fooddata-central), public domain | The carbs and fat of the first 112 foods in `source/foods.ts` |

## Citations

Each source asks for this credit wherever its values appear:

- **2024 Adult Compendium of Physical Activities**: Herrmann SD, Willis EA, Ainsworth BE, et al. 2024 Adult Compendium of Physical Activities: A third update of the energy costs of human activities. _Journal of Sport and Health Science_ 2024;13(1):6-12

The Taiwan FDA food composition set (Open Government Data License 1.0, attribution required) and the Korea MFDS everyday foods (no restriction) may also ship; add them to the table above, with the attribution Taiwan's license asks for, in the commit that first uses them.
