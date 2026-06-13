const PASSPHRASES = [
  { phrase: "GordonRamsayShoutsToGetMoreViews$", label: "Costa", namespace: "costa" },
  { phrase: "TestingKitchenLoopTest1", label: "Friend1", namespace: "Friend1" },
    { phrase: "KitchenLoopTest2", label: "Friend2", namespace: "Friend2" },
];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Passphrase',
};

const DEFAULT_RECIPES = [
  {name:'Chicken Pho',tags:'Dinner',ingredients:'Aniseed, Black Peppercorn, Cardamom, Cinnamon, Cloves, Egg Noodles, Fennel Seeds, Fish Sauce, Fresh Lime, Fresh Parsley, Fresh Chilli, Garlic, Ginger, Mustard Seeds, Onion, Rotisserie Chicken, Soy Sauce, Spring Onion, Water',notes:'',link:'https://www.instagram.com/reel/DN4b_V4kQUA/'},
  {name:'Kale & Ricotta Pasta',tags:'Dinner, Pasta',ingredients:'Black Peppercorn, Garlic, Grated Cheese, Kale, Lemon Zest, Onion, Pasta, Ricotta',notes:'',link:'https://www.instagram.com/reel/DCN6Uo5MjND/'},
  {name:'Chocolate Chickpea Cookies',tags:'Dessert',ingredients:'Any Chocolate, Any Milk, Baking Powder, Cacao, Canned Chickpeas, Maple Syrup, Salt, Vanilla Essence',notes:'Mix everything in blender, add milk little by little',link:''},
  {name:'Soba Noodle Salad',tags:'Dinner',ingredients:'Frozen Corn, Frozen Green Beans, Frozen Peas, Frozen Peppers, Garlic, Onion, Peanut Butter, Peanuts, Rice Wine Vinegar, Sesame Oil, Sesame Seeds, Sriracha, Soba Noodles, Soy Sauce',notes:'',link:'https://www.instagram.com/reel/DEX9H1iSgum/'},
  {name:'Chicken Cacciatore',tags:'Dinner',ingredients:'Anchovies, Bay Leaf, Black Peppercorn, Canned Peeled Tomatoes, Carrot, Chicken Drumsticks, Chicken Stock, Chicken Thighs, Cumin, Fennel Seeds, Garlic, Kunserva, Onion, Polenta, Red Wine, Rosemary, Thyme',notes:'',link:'https://www.instagram.com/reel/DA6kqlzR7HB/'},
  {name:'Peas on Toast',tags:'Breakfast, Dinner',ingredients:'Black Peppercorn, Bread, Cumin, Eggs, Frozen Peas, Garlic, Lemon, Olive Oil, Tahini',notes:'',link:'https://www.instagram.com/reel/DEf5TFyNgfQ/'},
  {name:'Egg and Potato Salad',tags:'Dinner',ingredients:'Apple Cider Vinegar, Cucumber, Eggs, Greek Yogurt, Mayonnaise, Mustard, Paprika Smokey, Paprika Sweet, Potato, Red Onion, Spring Onion',notes:'',link:'https://www.youtube.com/shorts/mhw8Eowrmqk'},
  {name:'Lemon White Chocolate Brownie',tags:'Dessert',ingredients:'Baking Powder, Butter, Eggs, Icing Sugar, Lemon, Salt, Self Raising Flour, Sugar, Vanilla, White Chocolate',notes:'',link:'https://www.instagram.com/reel/DIUmgmMSIxd/'},
  {name:'Lamb Greek Patties',tags:'Dinner',ingredients:'Balsamic Vinegar, Black Peppercorn, Butter Beans, Canned Chickpeas, Cous Cous, Cumin, Eggs, Fresh Mint, Fresh Parsley, Garlic, Kidney Beans, Lamb Mince, Lemon, Onion, Panko Breadcrumbs, Paprika Sweet, Rosemary',notes:'',link:'https://www.instagram.com/reel/DF98bjjTkZ5/'},
  {name:'Peanut Crumbed Chicken',tags:'Dinner',ingredients:'Black Peppercorn, Curry Powder, Eggs, Flour, Panko Breadcrumbs, Peanuts, Salt',notes:"Serve with mac'n'cheese, cous cous, or chips",link:'https://www.instagram.com/reel/DGVQ7v-IYSf/'},
  {name:'Chicken Milanesa',tags:'Dinner, Pasta',ingredients:'Balsamic Vinegar, Breadcrumbs, Chicken Breast, Eggs, Flour, Garlic, Grated Cheese, Onion, Panko Breadcrumbs, Paprika Sweet, Pasta, Rosemary, Thyme, Tomato Passata',notes:'',link:''},
  {name:'Yorkshire Puddings',tags:'Dinner',ingredients:'Black Peppercorn, Butter, Eggs, Flour, Hard Cheese, Milk, Vegetable Oil',notes:'',link:'https://www.instagram.com/reel/DC9kDF2NRju/'},
  {name:'Hungarian Mushroom Soup',tags:'Dinner',ingredients:'Beef Stock, Bread, Cornflour, Fresh Parsley, Frozen Mushrooms, Garlic, Greek Yogurt, Lemon, Mushroom Stock, Onion, Paprika Smokey, Paprika Sweet, Rosemary, Soy Sauce, Thyme, Worcestershire Sauce',notes:'',link:'https://www.instagram.com/reel/C73Iw4vMJyv/'},
  {name:'Chorizo, Leek and Potato Soup',tags:'Dinner',ingredients:'Bay Leaf, Chorizo, Cornflour, Cumin, Fresh Parsley, Leeks, Paprika Sweet, Potato, Vegetable Stock',notes:'',link:'https://www.instagram.com/reel/DBea0lIttMX/'},
  {name:'Tuna Pasta',tags:'Dinner, Pasta',ingredients:'Black Peppercorn, Egg Yolk, Garlic, Kunserva, Lemon, Pasta, Tuna',notes:'High protein',link:'https://www.instagram.com/reel/DCR1qR4uVc7/'},
  {name:'Authentic (White) Bolognese',tags:'Dinner, Pasta',ingredients:'Beef Mince, Beef Stock, Carrot, Celery, Flour, Nutmeg, Onion, Pancetta, Pasta, Rosemary',notes:'',link:''},
  {name:'Sausage & Peas Pasta',tags:'Dinner, Pasta',ingredients:'Cornflour, Frozen Peas, Garlic, Grated Cheese, Onion, Parmesan, Pasta, Pork Stock, Sausage',notes:'',link:'https://www.youtube.com/watch?v=hepwdT_Djng'},
  {name:'Chilli Garlic Noodles',tags:'Dinner',ingredients:'Chilli, Chilli Crisp, Egg Noodles, Garlic, Ginger, Gochujang Paste, Mayonnaise, Rice Wine Vinegar, Soy Sauce, Spring Onion',notes:'',link:'https://www.instagram.com/reel/C53j30prcYB/'},
  {name:'Crispy Pan Fried Fish',tags:'Dinner',ingredients:'Flour, Fresh Parsley, Frozen Green Beans, Lemon, Milk, Nutmeg, Paprika Smokey, Paprika Sweet, Potato, White Fish',notes:'',link:'https://www.instagram.com/p/BVVlf1CjiIb/'},
  {name:'Courgette Lasagna',tags:'Dinner',ingredients:'Breadcrumbs, Courgette, Flour, Gammon, Garlic, Grated Cheese, Milk, Olives, Onion, Provolone',notes:'',link:'https://www.instagram.com/reel/ChKo2WuDeYO/'},
  {name:'Chickpea Pita',tags:'Dinner, Lunch',ingredients:'Canned Chickpeas, Frozen Peppers, Garlic, Kunserva, Onion, Paprika Smokey, Paprika Sweet, Pitas',notes:'',link:'https://www.instagram.com/reel/CuXiplVKuA7/'},
  {name:'Gochujang Noodles',tags:'Dinner',ingredients:'Broccoli, Dumplings, Egg Noodles, Gochujang Paste, Honey, Lime, Miso Paste, Rice Wine Vinegar, Sesame Seeds, Soy Sauce, Spring Onion, Tahini',notes:'',link:'https://www.instagram.com/reel/CxGX_2GKiCb/'},
  {name:'Samkeh Harra',tags:'Dinner',ingredients:'Almonds, Chilli, Fresh Coriander, Garlic, Lemon, Paprika Smokey, Paprika Sweet, Sesame Oil, Sesame Seeds, Tahini, White Fish',notes:'Fish in Tahini Sauce',link:'https://www.instagram.com/reel/CuZit8tA-WS/'},
  {name:'Thai Green Noodles',tags:'Dinner',ingredients:'Canned Coconut Milk, Carrot, Frozen Green Beans, Frozen Peppers, Green Curry Paste, Rice Noodles, Soy Sauce',notes:'',link:'https://www.instagram.com/reel/C145V87tYiY/'},
  {name:'Smashed Burgers',tags:'Dinner',ingredients:'Beef Mince, Buns, Cheddar, Lettuce, Onion, Potato',notes:'',link:'https://www.instagram.com/reel/C3F_Ro-JrZk/'},
  {name:'Pad Kra Pao',tags:'Dinner',ingredients:'Beef Mince, Chilli, Chinese Five Spice, Eggs, Fish Sauce, Fresh Basil, Garlic, Honey, Onion, Oyster Sauce, Rice, Sesame Oil, Soy Sauce, Spring Onion',notes:'',link:'https://www.instagram.com/reel/C0MlM1FrLYA/'},
  {name:'Saag',tags:'Dinner',ingredients:'Coriander Powder, Cumin, Curry Powder, Fresh Tomatoes, Frozen Spinach, Garlic, Ginger, Lemon, Onion, Turmeric, Vegetable Stock, Yogurt',notes:'',link:'https://www.instagram.com/p/CMBH1JGgXan/'},
  {name:'Burger Wraps',tags:'Dinner',ingredients:'Beef Mince, Fresh Tomatoes, Onion, Tortillas, Yogurt',notes:'',link:''},
  {name:'Thai Drunken Noodles',tags:'Dinner',ingredients:'Chicken Thighs, Chilli, Fish Sauce, Fresh Basil, Garlic, Ginger, Honey, Onion, Oyster Sauce, Rice Noodles, Soy Sauce, Spring Onion',notes:'',link:'https://www.instagram.com/p/B4rNKPwHEAK/'},
  {name:'Chicken Laksa',tags:'Dinner',ingredients:'Canned Coconut Milk, Chicken Drumsticks, Chicken Stock, Chilli, Curry Paste, Egg Noodles, Fish Sauce, Fresh Coriander, Frozen Green Beans, Garlic, Ginger, Sweet Corn',notes:'',link:'https://www.instagram.com/p/CJjtpxgAaul/'},
  {name:'Peanut & Sweetcorn Fritters',tags:'Dinner',ingredients:'Baking Soda, Cornflour, Eggs, Flour, Fresh Coriander, Peanut Butter, Peanuts, Sesame Oil, Soy Sauce, Spring Onion, Sweet Corn',notes:'',link:'https://www.instagram.com/p/CNUX66YA_Jx/'},
  {name:'Samosa Pie',tags:'Dinner',ingredients:'Cauliflower, Coriander Powder, Curry Powder, Fennel Seeds, Frozen Peas, Frozen Spinach, Garlic, Ginger, Lime, Onion, Pastry, Potato, Spring Onion, Turmeric, Vegetable Stock',notes:'',link:'https://www.instagram.com/tv/CSo7mWwIO79/'},
  {name:'Aubergine Katsu Curry',tags:'Dinner',ingredients:'Aubergine, Carrot, Cornflour, Curry Powder, Eggs, Garam Masala, Garlic, Ginger, Honey, Lemon, Onion, Panko Breadcrumbs, Sesame Oil, Sesame Seeds, Soy Sauce, Spring Onion, Vegetable Stock',notes:'',link:'https://www.instagram.com/tv/CBlTVnCIpkK/'},
  {name:'Chicken Satay Curry',tags:'Dinner',ingredients:'Canned Coconut Milk, Cayenne Pepper, Chicken Stock, Chicken Thighs, Coriander Powder, Cumin, Curry Powder, Garlic, Honey, Lime, Onion, Paprika Smokey, Paprika Sweet, Peanut Butter, Peanuts, Soy Sauce, Turmeric',notes:'',link:'https://www.instagram.com/tv/CY9hPTeB-he/'},
  {name:'Butter Chicken',tags:'Dinner',ingredients:'Butter, Cashew Nuts, Cayenne Pepper, Chicken Breast, Coriander Powder, Cumin, Fresh Coriander, Fresh Parsley, Fresh Tomatoes, Garam Masala, Garlic, Ginger, Lemon, Onion, Yogurt',notes:'',link:'https://www.instagram.com/reel/CmldeiFtlmV/'},
  {name:'Pad Thai',tags:'Dinner',ingredients:'Brown Sugar, Cayenne Pepper, Chicken Breast, Eggs, Fish Sauce, Garlic, Lime, Onion, Oyster Sauce, Peanuts, Rice Noodles, Spring Onion, Tamarind Puree',notes:'',link:'https://www.instagram.com/reel/C3Epq0xvtlW/'},
  {name:'Coconut Daal',tags:'Dinner',ingredients:'Black Peppercorn, Canned Coconut Milk, Canned Tomatoes, Cayenne Pepper, Curry Powder, Fresh Coriander, Fresh Parsley, Frozen Peas, Garlic, Ginger, Onion, Red Lentils, Turmeric, Yogurt',notes:'',link:'https://www.instagram.com/p/CNmJK6KgxB0/'},
  {name:'Chettinad Chicken Curry',tags:'Dinner',ingredients:'Bay Leaf, Black Peppercorn, Canned Tomatoes, Cardamom, Chicken Thighs, Chilli, Cinnamon, Cloves, Coriander Powder, Cumin, Fennel Seeds, Garlic, Ginger, Grated Coconut, Lemon, Onion, Turmeric',notes:'',link:'https://www.instagram.com/reel/C3TKZSnIAdn/'},
  {name:'Salmon En Croute',tags:'Dinner',ingredients:'Eggs, Frozen Spinach, Garlic, Onion, Pastry, Red Pesto, Salmon Fillet',notes:'',link:'https://www.instagram.com/tv/CKjp_uND7uD/'},
  {name:'Salmon Curry',tags:'Dinner',ingredients:'Canned Coconut Milk, Cayenne Pepper, Coriander Powder, Fresh Tomatoes, Garlic, Ginger, Mustard Seeds, Onion, Salmon Fillet, Turmeric',notes:'',link:'https://www.instagram.com/reel/CbMpTguj-tq/'},
  {name:'Daal Makhani',tags:'Dinner',ingredients:'Cayenne Pepper, Garam Masala, Garlic, Rice, Tomato Passata, Tomato Paste, Turmeric',notes:'',link:'https://www.instagram.com/reel/Cg81H_CoQpr/'},
  {name:'Dry Rub Chicken',tags:'Dinner',ingredients:'Allspice, Cardamom, Cayenne Pepper, Chicken Drumsticks, Cornflour, Garlic Powder, Ginger, Nutmeg, Paprika Smokey, Paprika Sweet',notes:'',link:'https://www.instagram.com/p/B_fRMlHAB8V/'},
  {name:'Pasta Carbonara',tags:'Dinner, Pasta',ingredients:'Eggs, Hard Cheese, Pancetta, Pasta',notes:'',link:'https://www.instagram.com/reel/CcA0GOwlcwk/'},
  {name:'Burnt Leeks & Cannellini Bean Soup',tags:'Dinner',ingredients:'Bread, Cannellini Beans, Flour, Garlic, Leeks, Milk, Nutritional Yeast, Rosemary, White Wine',notes:'',link:'https://www.instagram.com/reel/CvR14mcqGB5/'},
  {name:'Chilli in a Taco Shell',tags:'Dinner',ingredients:'Bell Peppers, Black Beans, Chilli, Coriander Powder, Cumin, Fresh Tomatoes, Garlic, Kidney Beans, Lime, Onion, Paprika Smokey, Paprika Sweet, Parsley, Rice, Tomato Passata, Tomato Paste, Tortillas',notes:'',link:'https://www.instagram.com/tv/COaKK23NWlB/'},
  {name:'Broccoli & Feta Pie',tags:'Dinner',ingredients:'Broccoli, Feta, Eggs, Kefalyori, Milk, Greek Yogurt, Olive Oil, Flour',notes:'',link:'https://www.instagram.com/reel/DRr5fa3jERQ/'},
  {name:'Sweetcorn & Tuna Dip',tags:'Lunch',ingredients:'Tuna, Anchovies, Garlic, Kunserva, Kidney Beans, Ketchup, Canned Sweet Corn, Salt, Black Pepper',notes:'Serve with crackers',link:''},
  {name:'Egg & Sardines Dip',tags:'Lunch',ingredients:'Boiled Eggs, Sardines, Mustard, Kunserva, Olives, Onions, Basil, Garlic, Lemon, Black Pepper',notes:'Serve with crackers',link:''},
  {name:'Tomato Paste & Cucumbers',tags:'Lunch',ingredients:'Kunserva, Cucumber, Olive Oil, Black Peppercorn, Salt',notes:'Serve with crackers',link:''},
  {name:'Ham & Cheese',tags:'Lunch',ingredients:'Ham, Cheddar, Mustard, Butter',notes:'Serve on bread or crackers',link:''},
  {name:'Bean Salad',tags:'Lunch',ingredients:'Canned Butter Beans, Canned Kidney Beans, Lettuce, Olive Oil, Lemon, Black Peppercorn, Salt',notes:'',link:''},
].map((r, i) => ({ ...r, id: i + 1, cookDates: [] }));

function corsResponse(body, status = 200, extra = {}) {
  return new Response(body, {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', ...extra },
  });
}

async function getFile(env) {
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${env.GITHUB_FILE}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'kitchen-loop-worker',
    },
  });
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status}`);
  return res.json(); // { content, sha, ... }
}

async function putFile(env, content, sha) {
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${env.GITHUB_FILE}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'kitchen-loop-worker',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'chore: sync data.json via kitchen-loop-api',
      content: btoa(unescape(encodeURIComponent(content))),
      sha,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub PUT failed: ${res.status} ${err}`);
  }
  return res.json();
}

// GitHub wraps base64 content at 60 chars and may include \r, \n, or spaces — strip all first.
function parseFileContent(b64) {
  return JSON.parse(atob(b64.replace(/\s/g, '')));
}

// Read data.json and return { raw, allData, sha }.
// allData is always in namespaced form { "costa": {...}, ... }.
// If the file is in the old flat format (has "recipes" at root), it wraps it under "costa".
async function readAllData(env) {
  const file = await getFile(env);
  const raw = parseFileContent(file.content);
  const allData = raw.recipes !== undefined ? { costa: raw } : { ...raw };
  return { allData, sha: file.sha, wasLegacy: raw.recipes !== undefined };
}

function emptyNamespace() {
  return { recipes: [], plan: [], planHistory: [], shoppingChecked: {} };
}

function seededNamespace() {
  return { recipes: DEFAULT_RECIPES, plan: [], planHistory: [], shoppingChecked: {} };
}

export default {
  async fetch(request, env) {
    const { method, url } = request;
    const { pathname } = new URL(url);

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (pathname === '/auth' && method === 'POST') {
      try {
        const { phrase } = await request.json();
        const match = PASSPHRASES.find(p => p.phrase === phrase);
        if (!match) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
        return corsResponse(JSON.stringify({ namespace: match.namespace, label: match.label }));
      } catch (e) {
        return corsResponse(JSON.stringify({ error: 'Invalid request' }), 400);
      }
    }

    if (pathname === '/data' && method === 'GET') {
      const passphrase = request.headers.get('X-Passphrase');
      const match = PASSPHRASES.find(p => p.phrase === passphrase);
      if (!match) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
      try {
        const { allData, sha, wasLegacy } = await readAllData(env);
        const isNewUser = !(match.namespace in allData);
        const isEmptyLibrary = !isNewUser && allData[match.namespace].recipes?.length === 0;
        const shouldSeed = isNewUser || isEmptyLibrary;

        if (shouldSeed) {
          allData[match.namespace] = seededNamespace();
        }

        // Write back if we migrated legacy flat data or seeded a new/empty namespace
        if (wasLegacy || shouldSeed) {
          try { await putFile(env, JSON.stringify(allData), sha); } catch (_) {}
        }

        return corsResponse(JSON.stringify(allData[match.namespace]));
      } catch (e) {
        return corsResponse(JSON.stringify({ error: e.message }), 500);
      }
    }

    if (pathname === '/data' && method === 'PUT') {
      const passphrase = request.headers.get('X-Passphrase');
      const match = PASSPHRASES.find(p => p.phrase === passphrase);
      if (!match) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
      try {
        const body = await request.text();
        JSON.parse(body); // validate JSON before writing
        const { allData, sha } = await readAllData(env);
        allData[match.namespace] = JSON.parse(body);
        await putFile(env, JSON.stringify(allData), sha);
        return corsResponse(JSON.stringify({ ok: true }));
      } catch (e) {
        return corsResponse(JSON.stringify({ error: e.message }), 500);
      }
    }

    return corsResponse(JSON.stringify({ error: 'Not found' }), 404);
  },
};
