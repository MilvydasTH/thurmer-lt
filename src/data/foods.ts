import type { Aisle } from '../lib/types';

/**
 * Built-in food table: approximate nutrition per 100 g plus rough densities.
 * Values are rounded reference figures for raw/common forms — good for an estimate, not a label.
 *
 * Row: [id, aisle, kcal, protein, carbs, fat, gramsPerCup, gramsPerPiece, en, da, lt]
 * Aliases are '|' separated. A trailing '*' on a word means "any ending" (needed for Lithuanian cases).
 */
type Row = [string, Aisle, number, number, number, number, number, number, string, string, string];

const ROWS: Row[] = [
  // Produce
  ['onion', 'produce', 40, 1.1, 9.3, 0.1, 160, 110, 'onion|onions|yellow onion|red onion|shallot|shallots', 'løg|rødløg|skalotteløg|løget|løgene', 'svogūn*'],
  ['garlic', 'produce', 149, 6.4, 33, 0.5, 136, 5, 'garlic|garlic clove|garlic cloves', 'hvidløg|hvidløgsfed', 'česnak*'],
  ['tomato', 'produce', 18, 0.9, 3.9, 0.2, 180, 120, 'tomato|tomatoes|cherry tomatoes', 'tomat|tomater|cherrytomater|tomaterne', 'pomidor*'],
  ['potato', 'produce', 77, 2, 17, 0.1, 150, 170, 'potato|potatoes', 'kartoffel|kartofler|kartofl*', 'bulv*'],
  ['sweetpotato', 'produce', 86, 1.6, 20, 0.1, 133, 200, 'sweet potato|sweet potatoes', 'sød kartoffel|søde kartofler', 'batat*|saldži* bulv*'],
  ['carrot', 'produce', 41, 0.9, 9.6, 0.2, 128, 60, 'carrot|carrots', 'gulerod|gulerødder|guleroden|gulerødderne', 'mork*'],
  ['cucumber', 'produce', 15, 0.7, 3.6, 0.1, 120, 300, 'cucumber|cucumbers', 'agurk|agurker|agurken|agurkerne', 'agurk*'],
  ['bellpepper', 'produce', 31, 1, 6, 0.3, 150, 150, 'bell pepper|bell peppers|red pepper|green pepper|yellow pepper|capsicum', 'peberfrugt|peberfrugter', 'paprik*'],
  ['zucchini', 'produce', 17, 1.2, 3.1, 0.3, 124, 200, 'zucchini|courgette|courgettes', 'squash|courgette', 'cukinij*'],
  ['eggplant', 'produce', 25, 1, 6, 0.2, 82, 450, 'eggplant|aubergine|aubergines', 'aubergine|auberginer', 'baklažan*'],
  ['spinach', 'produce', 23, 2.9, 3.6, 0.4, 30, 0, 'spinach|baby spinach', 'spinat|babyspinat', 'špinat*'],
  ['lettuce', 'produce', 15, 1.4, 2.9, 0.2, 50, 300, 'lettuce|salad leaves|romaine|rocket|arugula', 'salat|salathoved|rucola', 'salot*|rukol*'],
  ['cabbage', 'produce', 25, 1.3, 5.8, 0.1, 90, 900, 'cabbage|white cabbage|red cabbage', 'kål|hvidkål|spidskål|rødkål', 'kopūst*'],
  ['broccoli', 'produce', 34, 2.8, 7, 0.4, 90, 300, 'broccoli', 'broccoli', 'brokol*'],
  ['cauliflower', 'produce', 25, 1.9, 5, 0.3, 100, 600, 'cauliflower', 'blomkål', 'žiedin* kopūst*|kalafior*'],
  ['mushroom', 'produce', 22, 3.1, 3.3, 0.3, 70, 18, 'mushroom|mushrooms', 'champignon|champignoner|svampe', 'gryb*|pievagryb*'],
  ['beetroot', 'produce', 43, 1.6, 10, 0.2, 136, 100, 'beet|beets|beetroot|beetroots', 'rødbede|rødbeder|rødbederne', 'burokėl*|burok*'],
  ['lemon', 'produce', 29, 1.1, 9, 0.3, 0, 60, 'lemon|lemons', 'citron|citroner', 'citrin*'],
  ['lemonjuice', 'produce', 22, 0.4, 6.9, 0.2, 240, 0, 'lemon juice|lime juice', 'citronsaft|limesaft', 'citrin* sul*|laim* sul*'],
  ['lime', 'produce', 30, 0.7, 10.5, 0.2, 0, 65, 'lime|limes', 'lime|limefrugt', 'laim*|žaliosi* citrin*'],
  ['apple', 'produce', 52, 0.3, 14, 0.2, 125, 180, 'apple|apples', 'æble|æbler', 'obuol*'],
  ['banana', 'produce', 89, 1.1, 23, 0.3, 150, 120, 'banana|bananas', 'banan|bananer', 'banan*'],
  ['orange', 'produce', 47, 0.9, 12, 0.1, 180, 130, 'orange|oranges', 'appelsin|appelsiner', 'apelsin*'],
  ['strawberry', 'produce', 32, 0.7, 7.7, 0.3, 150, 12, 'strawberry|strawberries|raspberries|berries', 'jordbær|hindbær|bær', 'brašk*|avieč*|uog*'],
  ['blueberry', 'produce', 57, 0.7, 14, 0.3, 148, 0, 'blueberry|blueberries', 'blåbær', 'mėlyn*|šilauog*'],
  ['avocado', 'produce', 160, 2, 9, 15, 150, 150, 'avocado|avocados', 'avocado|avocadoer', 'avokad*'],
  ['ginger', 'produce', 80, 1.8, 18, 0.8, 96, 0, 'ginger|fresh ginger', 'ingefær', 'imbier*'],
  ['springonion', 'produce', 32, 1.8, 7.3, 0.2, 100, 15, 'spring onion|spring onions|scallion|scallions|green onion|green onions|chives', 'forårsløg|purløg', 'svogūn* laišk*|laišk*'],
  ['dill', 'produce', 43, 3.5, 7, 1.1, 9, 0, 'dill', 'dild', 'krap*'],
  ['parsley', 'produce', 36, 3, 6.3, 0.8, 60, 0, 'parsley', 'persille', 'petražol*'],
  ['basil', 'produce', 23, 3.2, 2.7, 0.6, 24, 0, 'basil|fresh basil|mint', 'basilikum|mynte', 'bazilik*|mėt*'],
  ['coriander', 'produce', 23, 2.1, 3.7, 0.5, 16, 0, 'cilantro|coriander|fresh coriander', 'koriander', 'kalendr*'],
  ['chili', 'produce', 40, 1.9, 8.8, 0.4, 0, 15, 'chili|chilli|chile|chilies|chillies|jalapeño|jalapeno', 'chili|chilier', 'čili|aitrioj* paprik*'],
  ['leek', 'produce', 61, 1.5, 14, 0.3, 89, 150, 'leek|leeks', 'porre|porrer', 'poras|porai|porų|poro'],
  ['celery', 'produce', 16, 0.7, 3, 0.2, 100, 40, 'celery|celery stalk|celery stalks', 'selleri|bladselleri', 'salier*'],
  ['radish', 'produce', 16, 0.7, 3.4, 0.1, 116, 10, 'radish|radishes', 'radise|radiser', 'ridikėl*'],
  ['peas', 'frozen', 81, 5.4, 14, 0.4, 145, 0, 'peas|green peas|frozen peas', 'ærter', 'žirn*'],
  ['corn', 'canned', 86, 3.3, 19, 1.4, 154, 0, 'corn|sweetcorn|sweet corn', 'majs', 'kukurūz*'],
  ['pumpkin', 'produce', 26, 1, 6.5, 0.1, 116, 0, 'pumpkin|butternut squash|butternut', 'græskar|hokkaido', 'moliūg*'],

  // Dairy & eggs
  ['milk', 'dairy', 60, 3.3, 4.8, 3.2, 245, 0, 'milk|whole milk|skim milk', 'mælk|sødmælk|letmælk|minimælk|skummetmælk|mælken', 'pien*'],
  ['butter', 'dairy', 717, 0.9, 0.1, 81, 227, 0, 'butter|unsalted butter|salted butter', 'smør|smørret', 'sviest*'],
  ['cream', 'dairy', 340, 2.1, 2.8, 36, 240, 0, 'cream|heavy cream|double cream|whipping cream|single cream', 'fløde|piskefløde|madlavningsfløde|fløden', 'grietinėl*'],
  ['sourcream', 'dairy', 193, 2.4, 4.6, 19, 230, 0, 'sour cream|creme fraiche|crème fraîche', 'creme fraiche|cremefraiche|crème fraîche', 'grietin*'],
  ['yogurt', 'dairy', 61, 3.5, 4.7, 3.3, 245, 0, 'yogurt|yoghurt|greek yogurt|plain yogurt', 'yoghurt|skyr|græsk yoghurt', 'jogurt*'],
  ['kefir', 'dairy', 50, 3.4, 4.7, 2, 245, 0, 'kefir|buttermilk', 'kærnemælk|kefir', 'kefyr*|pasuk*'],
  ['cheese', 'dairy', 380, 25, 1.3, 31, 113, 20, 'cheese|cheddar|mozzarella|gouda|grated cheese', 'ost|revet ost|mozzarella|cheddar', 'sūr*|mocarel*'],
  ['parmesan', 'dairy', 431, 38, 4, 29, 90, 0, 'parmesan|parmigiano|pecorino', 'parmesan|parmesanost', 'parmezan*'],
  ['feta', 'dairy', 264, 14, 4, 21, 150, 0, 'feta|feta cheese|halloumi', 'feta|fetaost|halloumi', 'feta|fetos|fetą'],
  ['curd', 'dairy', 98, 11, 3.4, 4.3, 225, 0, 'cottage cheese|quark|curd cheese|ricotta', 'hytteost|kvark|ricotta', 'varšk*'],
  ['creamcheese', 'dairy', 342, 6, 4, 34, 232, 0, 'cream cheese|mascarpone', 'flødeost|mascarpone', 'kremin* sūr*|maskarpon*'],
  ['egg', 'dairy', 143, 12.6, 0.7, 9.5, 243, 50, 'egg|eggs|large egg|large eggs', 'æg|ægget|æggene', 'kiaušin*'],

  // Meat & fish
  ['chicken', 'meat', 120, 22.5, 0, 2.6, 140, 170, 'chicken|chicken breast|chicken breasts|chicken fillet', 'kylling|kyllingebryst|kyllingefilet|kyllingebrystfilet', 'vištien*|višt*'],
  ['chickenthigh', 'meat', 177, 20, 0, 10, 140, 110, 'chicken thigh|chicken thighs|chicken legs', 'kyllingelår|kyllingeoverlår', 'višt* šlaunel*|vištien* šlaunel*'],
  ['mincedbeef', 'meat', 250, 17, 0, 20, 225, 0, 'ground beef|minced beef|beef mince|mince|minced meat', 'hakket oksekød|oksefars|hakkekød', 'malt* jautien*|jautien* farš*|malt* mės*|farš*'],
  ['beef', 'meat', 187, 20, 0, 12, 0, 200, 'beef|steak|stewing beef', 'oksekød|bøf|okse', 'jautien*'],
  ['pork', 'meat', 200, 20, 0, 13, 0, 150, 'pork|pork loin|pork chop|pork chops|pork tenderloin', 'svinekød|flæsk|svinekotelet|svinemørbrad|grisekød', 'kiaulien*'],
  ['mincedpork', 'meat', 263, 17, 0, 21, 225, 0, 'ground pork|minced pork|pork mince', 'hakket svinekød|hakket kalv og flæsk|hakket grisekød', 'malt* kiaulien*|kiaulien* farš*'],
  ['bacon', 'meat', 417, 13, 1.3, 40, 0, 15, 'bacon|pancetta', 'bacon', 'šonin*|bekon*'],
  ['ham', 'meat', 145, 21, 1.5, 6, 0, 20, 'ham', 'skinke', 'kump*'],
  ['sausage', 'meat', 300, 12, 2, 27, 0, 75, 'sausage|sausages|chorizo', 'pølse|pølser|chorizo', 'dešr*'],
  ['salmon', 'meat', 208, 20, 0, 13, 0, 150, 'salmon|salmon fillet|salmon fillets', 'laks|laksefilet', 'lašiš*'],
  ['tuna', 'canned', 116, 26, 0, 1, 0, 0, 'tuna|canned tuna', 'tun', 'tunas|tuno|tuną'],
  ['whitefish', 'meat', 82, 18, 0, 0.7, 0, 150, 'cod|white fish|haddock|fish fillet|fish', 'torsk|fisk|fiskefilet', 'menk*|žuv*'],
  ['herring', 'meat', 158, 18, 0, 9, 0, 80, 'herring', 'sild', 'silk*'],
  ['shrimp', 'meat', 99, 24, 0.2, 0.3, 0, 0, 'shrimp|prawns|prawn', 'rejer', 'krevet*'],

  // Bakery
  ['bread', 'bakery', 265, 9, 49, 3.2, 0, 35, 'bread|toast|sourdough|rye bread|baguette', 'brød|rugbrød|franskbrød|toastbrød', 'duon*|batonas|batono'],
  ['tortilla', 'bakery', 310, 8, 50, 8, 0, 45, 'tortilla|tortillas|wrap|wraps|pita', 'tortilla|tortillas|pitabrød', 'tortilij*|lavaš*'],
  ['breadcrumbs', 'pantry', 395, 13, 72, 5, 108, 0, 'breadcrumbs|bread crumbs|panko', 'rasp', 'džiūvėsėl*'],

  // Pantry
  ['flour', 'pantry', 364, 10, 76, 1, 125, 0, 'flour|all-purpose flour|all purpose flour|plain flour|wheat flour|bread flour', 'mel|hvedemel|melet', 'milt*'],
  ['sugar', 'pantry', 387, 0, 100, 0, 200, 0, 'sugar|caster sugar|granulated sugar|white sugar', 'sukker', 'cukr*'],
  ['brownsugar', 'pantry', 380, 0, 98, 0, 213, 0, 'brown sugar', 'brun farin|farin|rørsukker', 'rud* cukr*'],
  ['powderedsugar', 'pantry', 389, 0, 100, 0, 120, 0, 'powdered sugar|icing sugar|confectioners sugar', 'flormelis', 'cukr* pudr*'],
  ['honey', 'pantry', 304, 0.3, 82, 0, 340, 0, 'honey|maple syrup|syrup', 'honning|sirup|ahornsirup', 'medus|medaus|medų|sirup*'],
  ['rice', 'pantry', 360, 7, 79, 0.6, 185, 0, 'rice|basmati rice|jasmine rice|white rice', 'ris|basmatiris|jasminris', 'ryž*'],
  ['pasta', 'pantry', 371, 13, 75, 1.5, 100, 0, 'pasta|spaghetti|penne|macaroni|noodles|fusilli|tagliatelle', 'pasta|spaghetti|penne|nudler', 'makaron*|spageč*'],
  ['oats', 'pantry', 379, 13, 68, 6.5, 90, 0, 'oats|rolled oats|oatmeal', 'havregryn', 'aviž*'],
  ['oliveoil', 'pantry', 884, 0, 0, 100, 216, 0, 'olive oil|extra virgin olive oil', 'olivenolie', 'alyvuog* aliej*'],
  ['oil', 'pantry', 884, 0, 0, 100, 218, 0, 'oil|vegetable oil|sunflower oil|canola oil|rapeseed oil|sesame oil', 'olie|rapsolie|solsikkeolie', 'aliej*'],
  ['vinegar', 'pantry', 20, 0, 0.6, 0, 240, 0, 'vinegar|balsamic vinegar|white wine vinegar|apple cider vinegar', 'eddike|balsamico|æblecidereddike', 'act*'],
  ['soysauce', 'pantry', 53, 8, 4.9, 0.6, 255, 0, 'soy sauce|soya sauce|fish sauce', 'sojasauce|soja|fiskesauce', 'soj* padaž*'],
  ['ketchup', 'pantry', 101, 1, 27, 0.1, 240, 0, 'ketchup', 'ketchup', 'kečup*'],
  ['tomatopaste', 'canned', 82, 4.3, 19, 0.5, 262, 0, 'tomato paste|tomato puree|tomato purée', 'tomatpuré|tomatkoncentrat', 'pomidor* past*'],
  ['mustard', 'pantry', 66, 4, 6, 3.3, 250, 0, 'mustard|dijon mustard', 'sennep|dijonsennep', 'garstyč*'],
  ['mayo', 'pantry', 680, 1, 0.6, 75, 220, 0, 'mayonnaise|mayo', 'mayonnaise|mayo', 'majonez*'],
  ['stock', 'pantry', 5, 0.5, 0.5, 0.2, 240, 0, 'stock|broth|chicken stock|vegetable stock|beef stock|chicken broth|vegetable broth|bouillon', 'bouillon|fond|hønsebouillon|grøntsagsbouillon', 'sultin*'],
  ['water', 'other', 0, 0, 0, 0, 240, 0, 'water|cold water|warm water|boiling water', 'vand', 'vanduo|vanden*'],
  ['bakingpowder', 'pantry', 53, 0, 28, 0, 220, 0, 'baking powder', 'bagepulver', 'kepim* miltel*'],
  ['bakingsoda', 'pantry', 0, 0, 0, 0, 220, 0, 'baking soda|bicarbonate of soda', 'natron', 'soda|sodos|sodą'],
  ['yeast', 'pantry', 105, 8, 18, 1.9, 0, 0, 'yeast|dry yeast|instant yeast', 'gær|tørgær', 'miel*'],
  ['cocoa', 'pantry', 228, 20, 58, 14, 85, 0, 'cocoa|cocoa powder|cacao', 'kakao|kakaopulver', 'kakav*'],
  ['chocolate', 'pantry', 546, 5, 61, 31, 170, 0, 'chocolate|dark chocolate|milk chocolate|chocolate chips', 'chokolade|mørk chokolade', 'šokolad*'],
  ['almonds', 'pantry', 579, 21, 22, 50, 143, 0, 'almonds|almond|cashews|hazelnuts|nuts', 'mandler|cashewnødder|hasselnødder|nødder', 'migdol*|riešut*'],
  ['walnuts', 'pantry', 654, 15, 14, 65, 117, 0, 'walnuts|pecans', 'valnødder', 'graikin* riešut*'],
  ['peanutbutter', 'pantry', 588, 25, 20, 50, 258, 0, 'peanut butter|tahini', 'peanutbutter|jordnøddesmør|tahin', 'riešut* sviest*|tahin*'],
  ['lentils', 'pantry', 352, 25, 63, 1, 192, 0, 'lentils|red lentils|green lentils', 'linser|røde linser', 'lęš*'],
  ['chickpeas', 'canned', 139, 7, 22, 2.8, 164, 0, 'chickpeas|chick peas', 'kikærter', 'avinžirn*'],
  ['beans', 'canned', 127, 8.7, 22.8, 0.5, 177, 0, 'beans|kidney beans|black beans|white beans|cannellini beans', 'bønner|kidneybønner|sorte bønner', 'pupel*'],
  ['cannedtomato', 'canned', 21, 1, 4, 0.2, 240, 0, 'canned tomatoes|chopped tomatoes|crushed tomatoes|diced tomatoes|passata|tomato sauce', 'hakkede tomater|flåede tomater|passata|tomatsauce', 'konservuot* pomidor*|trint* pomidor*|pomidor* padaž*'],
  ['coconutmilk', 'canned', 197, 2, 2.8, 21, 240, 0, 'coconut milk|coconut cream', 'kokosmælk', 'kokos* pien*'],
  ['buckwheat', 'pantry', 343, 13, 72, 3.4, 170, 0, 'buckwheat', 'boghvede', 'grik*'],
  ['grains', 'pantry', 360, 12, 75, 1.5, 173, 0, 'couscous|bulgur|quinoa|barley', 'couscous|bulgur|quinoa|perlebyg', 'kuskus*|bulgur*|bolivin* baland*|kruop*'],
  ['starch', 'pantry', 381, 0, 91, 0, 128, 0, 'cornstarch|corn starch|cornflour|potato starch', 'maizena|majsstivelse|kartoffelmel', 'krakmol*'],
  ['raisins', 'pantry', 299, 3, 79, 0.5, 165, 0, 'raisins|dates|dried fruit', 'rosiner|dadler', 'razin*|datul*'],
  ['jam', 'pantry', 250, 0.4, 65, 0.1, 320, 0, 'jam|marmalade', 'marmelade|syltetøj', 'uogien*|džem*'],
  ['sesame', 'pantry', 573, 18, 23, 50, 144, 0, 'sesame seeds|sesame|sunflower seeds|chia seeds|seeds', 'sesamfrø|solsikkekerner|chiafrø', 'sezam*|sėkl*'],

  // Spices
  ['salt', 'spices', 0, 0, 0, 0, 290, 0, 'salt|sea salt|kosher salt', 'salt|havsalt', 'drusk*'],
  ['pepper', 'spices', 251, 10, 64, 3.3, 110, 0, 'pepper|black pepper|ground pepper', 'peber|sort peber', 'pipir*'],
  ['paprikaspice', 'spices', 282, 14, 54, 13, 110, 0, 'paprika|smoked paprika|chili powder|chili flakes', 'paprika|røget paprika|chilipulver', 'rūkyt* paprik*|paprik* miltel*'],
  ['cumin', 'spices', 375, 18, 44, 22, 100, 0, 'cumin|ground cumin|caraway', 'spidskommen|kommen', 'kmyn*'],
  ['cinnamon', 'spices', 247, 4, 81, 1.2, 125, 0, 'cinnamon|nutmeg|cardamom', 'kanel|muskatnød|kardemomme', 'cinamon*|muskat*|kardamon*'],
  ['driedherbs', 'spices', 265, 9, 69, 4, 48, 0, 'oregano|thyme|rosemary|bay leaf|bay leaves|italian seasoning|dried herbs', 'oregano|timian|rosmarin|laurbærblad|laurbærblade', 'raudonėl*|čiobrel*|rozmarin*|lauro lap*|lauro lapel*'],
  ['curry', 'spices', 325, 14, 56, 14, 100, 0, 'curry|curry powder|turmeric|garam masala', 'karry|gurkemeje', 'kario|karis|kari|ciberžol*'],
  ['vanilla', 'spices', 288, 0, 13, 0, 208, 0, 'vanilla|vanilla extract|vanilla sugar', 'vanilje|vaniljesukker|vaniljeekstrakt', 'vanil*'],

  // Frozen & drinks
  ['icecream', 'frozen', 207, 3.5, 24, 11, 132, 0, 'ice cream', 'is|flødeis|vaniljeis', 'ledai|ledų'],
  ['wine', 'drinks', 83, 0.1, 2.6, 0, 240, 0, 'wine|white wine|red wine', 'vin|hvidvin|rødvin', 'vyn*'],
  ['juice', 'drinks', 45, 0.7, 10, 0.2, 248, 0, 'juice|orange juice|apple juice', 'juice|saft|appelsinjuice|æblejuice', 'sult*'],
];

export interface Food {
  id: string;
  aisle: Aisle;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  gPerCup: number;
  gPerPiece: number;
  /** Everyday Danish name, used to look the food up in Danish stores. */
  da: string;
}

interface Matcher {
  food: Food;
  re: RegExp;
  weight: number;
}

const L = '\\p{L}';

function aliasToRegExp(alias: string): RegExp {
  const body = alias
    .split(' ')
    .map((w) => {
      const stem = w.endsWith('*');
      const core = (stem ? w.slice(0, -1) : w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return stem ? `${core}${L}*` : core;
    })
    .join('\\s+');
  return new RegExp(`(?<!${L})${body}(?!${L})`, 'u');
}

const MATCHERS: Matcher[] = [];
const BY_FOOD = new Map<string, RegExp[]>();
for (const r of ROWS) {
  const food: Food = {
    id: r[0], aisle: r[1], kcal: r[2], protein: r[3], carbs: r[4], fat: r[5], gPerCup: r[6], gPerPiece: r[7],
    da: r[9].split('|')[0],
  };
  const own: RegExp[] = [];
  BY_FOOD.set(food.id, own);
  for (const aliases of [r[8], r[9], r[10]]) {
    for (const alias of aliases.split('|')) {
      if (!alias) continue;
      const re = aliasToRegExp(alias);
      MATCHERS.push({ food, re, weight: alias.replace(/\*/g, '').length });
      own.push(re);
    }
  }
}
MATCHERS.sort((a, b) => b.weight - a.weight);

const cache = new Map<string, Food | null>();

/** Best-effort lookup of an ingredient name in English, Danish or Lithuanian. */
export function matchFood(name: string): Food | undefined {
  const key = name.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!key) return undefined;
  const hit = cache.get(key);
  if (hit !== undefined) return hit ?? undefined;
  let found: Food | null = null;
  for (const m of MATCHERS) {
    if (m.re.test(key)) {
      found = m.food;
      break;
    }
  }
  if (cache.size > 2000) cache.clear();
  cache.set(key, found);
  return found ?? undefined;
}

export function aisleFor(name: string): Aisle {
  return matchFood(name)?.aisle ?? 'other';
}

/** True when the text names this food under any of its aliases, even if a longer food name is also present. */
export function mentionsFood(text: string, foodId: string): boolean {
  const key = text.toLowerCase().replace(/\s+/g, ' ');
  return (BY_FOOD.get(foodId) ?? []).some((re) => re.test(key));
}

/** Ids of every food in the table, for tooling. */
export const FOOD_IDS: string[] = ROWS.map((r) => r[0]);

/**
 * Foods named in a sentence, in the order they appear ("Boil the potatoes, then slice the
 * cucumber" → potato, cucumber). A food whose name sits inside a longer one is dropped,
 * so "olive oil" does not also count as "oil".
 */
export function foodsMentioned(text: string): string[] {
  const key = text.toLowerCase().replace(/\s+/g, ' ');
  const hits: { id: string; start: number; end: number }[] = [];
  for (const [id, patterns] of BY_FOOD) {
    let best: { start: number; end: number } | undefined;
    for (const re of patterns) {
      const m = re.exec(key);
      if (m && (!best || m[0].length > best.end - best.start)) best = { start: m.index, end: m.index + m[0].length };
    }
    if (best) hits.push({ id, ...best });
  }
  return hits
    .filter((h) => !hits.some((o) => o !== h && o.start <= h.start && o.end >= h.end && o.end - o.start > h.end - h.start))
    .sort((a, b) => a.start - b.start)
    .map((h) => h.id);
}
