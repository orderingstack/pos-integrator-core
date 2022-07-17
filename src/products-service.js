const axios = require('axios');
const {logger} = require('./logger');

/**
productsToImport: [
{ name, description, price, name-en, description-en, name-jp, description-jp, imageUrl,  category, ordincat, subcategory, ordinsubcat, reportCategory },
{ name, description, price, name-en, description-en, name-jp, description-jp, imageUrl,  category, ordincat, subcategory, ordinsubcat, reportCategory },
...
]
*/
async function importProductsToOrderingStack(productsToImport, authDataProviderCallbackAsync, alterProductBeforeImportCallback, concurrencyLevel = 10) {
  //one by one approach 
  const result = [];
  let index = 1;
  const count = productsToImport.length;
  for (const prod of productsToImport) {
    const { access_token } = await authDataProviderCallbackAsync();
    const res = await importSingleProduct(prod, access_token, alterProductBeforeImportCallback, index++, count);
    result.push(res);
  }
  /*
    //parallel approach
    let result = [];
    const promises = productsToImport.map(prod=>importSingleProduct(prod, token, alterProductBeforeImportCallback));
    while (promises.length) {
      // concurrencyLevel at at time
      const batchResult = await Promise.all( promises.splice(0, concurrencyLevel) );
      await new Promise(resolve => setTimeout(resolve, 500));
      result = result.concat(batchResult);
    }
    */
  const output = {
    imported: 0,
    errors: []
  }
  result.map(e => { if (e.ok) output.imported++; else output.errors.push(e.err) });
  return output;
}


/**
 * 
 * @param {*} productToImport
 * @param  token
 * @param {*} alterProductBeforeImportCallback - function(product, productToImport) returing altered product based on ProductToImport data 
 * @returns {ok: boolean, err: string}
 */
async function importSingleProduct(productToImport, token, alterProductBeforeImportCallback, index, count) {
  let { product, err } = await fetchCurrentProduct(productToImport.id, token);
  if (!err) {
    product = initialProductRecordSettings(product, productToImport);
    product = alterProductBeforeImportCallback(product, productToImport, index, count);
    const result = await saveChangedProduct(product, token);
    return result;
  } else {
    return { ok: false, err }
  }
}

async function fetchCurrentProduct(id, token) {
  //logger.debug(`fetching product ${id}`);
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
    return { product: {}, err: null };  //new product
  };
}

function initialProductRecordSettings(prod, prodToImport) {
  if (!prod || Object.keys(prod).length === 0) {
    prod = { "kind": "3e/product" };
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
  //logger.debug(`saving product ${prod.id}`);
  let newProduct = false;
  if (prod.__new) {
    newProduct = true;
    delete prod.__new;
  }
  let burl = `${process.env.BASE_URL}`;
  burl += burl.endsWith("/") ? "" : "/"
  const url = `${burl}menu-api/api/items/${newProduct ? '' : prod.id}`;
  const axcall = {
    url,
    method: newProduct ? 'POST' : 'PUT',
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
    return { ok: false, err: err.message }
  };
}

module.exports = {
  importProductsToOrderingStack
}