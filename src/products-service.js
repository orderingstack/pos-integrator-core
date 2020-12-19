const axios = require('axios');

/**
productsToImport: [
{ name, description, price, name-en, description-en, name-jp, description-jp, imageUrl,  category, ordincat, subcategory, ordinsubcat, reportCategory },
{ name, description, price, name-en, description-en, name-jp, description-jp, imageUrl,  category, ordincat, subcategory, ordinsubcat, reportCategory },
...
]

*/
async function importProductsToOrderingStack (productsToImport, token, alterProductBeforeImportCallback) {
  const importedIds = [];
  const errors = [];
  for (const prod of productsToImport) {
    const result = await importSingleProduct(prod, token, alterProductBeforeImportCallback);
    if (result.ok) {
      importedIds.push(prod.id);
    } else {
      errors.push({ id: prod.id, err: result.err });
    }
  }
  return { imported: importedIds, errors };
}


/**
 * 
 * @param {*} productToImport
 * @param  token
 * @param {*} alterProductBeforeImportCallback - function(product, productToImport) returing altered product based on ProductToImport data 
 * @returns {ok: boolean, err: string}
 */
async function importSingleProduct(productToImport, token, alterProductBeforeImportCallback) {
  let { product, err } = await fetchCurrentProduct(productToImport.id, token);
  if (!err) {
    product = initialProductRecordSettings(product, productToImport);
    product = alterProductBeforeImportCallback(product, productToImport);
    const result = await saveChangedProduct(product, token);
    return result;
  } else {
    return { ok: false, err }
  }
}

async function fetchCurrentProduct(id, token) {
  console.log(`fetching product ${id}`);
  let burl = `${process.env.BASE_URL}`;
  burl += burl.endsWith("/") ? "" : "/"
  const url = `${burl}menu-api/api/items/${id}`;
  const axconfig = {
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    }
  };
  try {
    const resp = await axios.get(url, axconfig);
    return { product: resp.data, err: null }
  } catch (err) {
      return { product: { }, err: null };  //new product
  };
}

function initialProductRecordSettings(prod, prodToImport) {
  if (!prod || Object.keys(prod).length === 0) {
    prod = {"kind": "3e/product" };
    prod.pricelists = [
      {
        "name": "PL_default",
        "price": null
      }
    ];
    prod.__new = true;
  };
  prod.id = prodToImport.id;      
  
  if (!prod._) {
    prod._ = {};
  }  
  return prod;
}

async function saveChangedProduct(prod, token) {
  console.log(`saving product ${prod.id}`);
  let newProduct = false;
  if (prod.__new) {
    newProduct = true;
    delete prod.__new;
  }
  let burl = `${process.env.BASE_URL}`;
  burl += burl.endsWith("/") ? "" : "/"
  const url = `${burl}menu-api/api/items/${newProduct?'':prod.id}`;
  const axcall = {
    url,
    method: newProduct?'POST':'PUT',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    data: prod
  };
  try {
    const r = await axios.request(axcall);
    return { ok: true, err: null }
  } catch (err) {
    return { ok: false, err:err.message }
  };
}

module.exports = {
  importProductsToOrderingStack
}