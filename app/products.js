const productForm = document.querySelector('#product-form');
const submitButton = productForm.querySelector('button[type="submit"]');
const listButton = document.querySelector('#list-button');
const formMessage = document.querySelector('#form-message');
const listMessage = document.querySelector('#list-message');
const productList = document.querySelector('#product-list');
const productRows = document.querySelector('#product-rows');
const priceFormat = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function showMessage(element, message, state) {
  element.textContent = message;
  element.dataset.state = state;
}

async function requestApi(path, options) {
  const configuredUrl = document.querySelector('meta[name="api-base-url"]').content.trim();
  const apiUrl = URL.canParse(configuredUrl) ? new URL(configuredUrl) : null;

  if (!apiUrl || !['http:', 'https:'].includes(apiUrl.protocol)) {
    throw new Error('Configure o endereço HTTP ou HTTPS da API da VM2.');
  }

  let response;
  try {
    response = await fetch(new URL(path, apiUrl), {
      ...options,
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new Error('Não foi possível conectar à API. Verifique o endereço e tente novamente.');
  }

  if (!response.ok) {
    throw new Error(`A API retornou um erro (HTTP ${response.status}).`);
  }

  return response;
}

productForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const product = {
    name: productForm.elements.namedItem('name').value.trim(),
    category: productForm.elements.namedItem('category').value.trim(),
    price: productForm.elements.namedItem('price').valueAsNumber,
    quantity: productForm.elements.namedItem('quantity').valueAsNumber,
  };

  if (!product.name || !product.category || !Number.isSafeInteger(product.quantity)) {
    showMessage(formMessage, 'Informe o nome, a categoria e uma quantidade inteira válida.', 'error');
    return;
  }

  submitButton.disabled = true;
  showMessage(formMessage, 'Cadastrando produto…', 'pending');

  try {
    await requestApi('/produto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    });
    productForm.reset();
    showMessage(formMessage, 'Produto cadastrado com sucesso.', 'success');
  } catch (error) {
    showMessage(formMessage, error.message, 'error');
  } finally {
    submitButton.disabled = false;
  }
});

function renderProducts(products) {
  const rows = document.createDocumentFragment();

  for (const { name, category, price, quantity } of products) {
    const row = document.createElement('tr');
    for (const value of [name, category, priceFormat.format(Number(price)), quantity]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    rows.append(row);
  }

  productRows.replaceChildren(rows);
  productList.hidden = products.length === 0;
}

listButton.addEventListener('click', async () => {
  listButton.disabled = true;
  productList.hidden = true;
  showMessage(listMessage, 'Consultando produtos…', 'pending');

  try {
    const response = await requestApi('/produtos', { method: 'GET' });
    const products = await response.json().catch(() => null);
    if (!Array.isArray(products)) {
      throw new Error('A API retornou uma lista de produtos em formato inválido.');
    }

    renderProducts(products);
    const message = products.length ? 'Lista de produtos atualizada.' : 'Nenhum produto cadastrado.';
    showMessage(listMessage, message, 'success');
  } catch (error) {
    showMessage(listMessage, error.message, 'error');
  } finally {
    listButton.disabled = false;
  }
});
