// Same-origin path: works both locally with `netlify dev` and after deployment.
const API_BASE_URL = '/.netlify/functions';

let allProducts = [];

const byId = (id) => document.getElementById(id);
const displayValue = (value, fallback = '—') =>
    value === null || value === undefined || value === '' ? fallback : String(value);
const money = (value) => `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
})}`;

function makeElement(tagName, text, className) {
    const element = document.createElement(tagName);
    if (text !== undefined) element.textContent = displayValue(text, '');
    if (className) element.className = className;
    return element;
}

function showMessage(container, message, isError = false) {
    container.replaceChildren(makeElement('p', message, isError ? 'error' : 'status-message'));
}

async function requestJson(path) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        headers: { Accept: 'application/json' }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'The database request failed');
    return payload;
}

function renderTable(title, columns, rows) {
    const wrapper = document.createElement('div');
    const heading = makeElement('h3', title);
    const table = document.createElement('table');
    const caption = makeElement('caption', title);
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const tbody = document.createElement('tbody');

    columns.forEach((column) => {
        const header = makeElement('th', column.label);
        header.scope = 'col';
        headerRow.appendChild(header);
    });

    rows.forEach((row) => {
        const tableRow = document.createElement('tr');
        columns.forEach((column) => {
            const rawValue = row[column.value];
            const value = column.format ? column.format(rawValue) : displayValue(rawValue);
            tableRow.appendChild(makeElement('td', value));
        });
        tbody.appendChild(tableRow);
    });

    thead.appendChild(headerRow);
    table.append(caption, thead, tbody);
    wrapper.append(heading, table);
    return wrapper;
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
});

// Load all products
async function loadProducts() {
    try {
        allProducts = await requestJson('/products');
        displayProducts(allProducts);
    } catch (error) {
        console.error('Error loading products:', error);
        showMessage(byId('product-list'), error.message, true);
    }
}

// Display products
function displayProducts(products) {
    const container = byId('product-list');
    
    if (!products || products.length === 0) {
        showMessage(container, 'No products found.');
        return;
    }
    
    const cards = products.map((product) => {
        const card = makeElement('article', undefined, 'product-card');
        card.append(
            makeElement('h3', product.product_name),
            makeElement('p', product.category, 'product-category'),
            makeElement('p', money(product.price), 'product-price'),
            makeElement('p', `Stock: ${displayValue(product.stock_quantity, '0')}`, 'product-stock')
        );
        return card;
    });
    container.replaceChildren(...cards);
}

// Search products
async function searchProducts() {
    const searchTerm = document.getElementById('search-input').value;
    
    if (!searchTerm) {
        displayProducts(allProducts);
        return;
    }
    
    try {
        displayProducts(await requestJson(`/search?q=${encodeURIComponent(searchTerm)}`));
    } catch (error) {
        console.error('Search failed:', error);
    }
}

// Filter by category
function filterByCategory() {
    const category = document.getElementById('category-filter').value;
    
    if (!category) {
        displayProducts(allProducts);
        return;
    }
    
    const filtered = allProducts.filter(p => p.category === category);
    displayProducts(filtered);
}

// Filter by price
function filterByPrice() {
    const priceRange = document.getElementById('price-filter').value;
    
    if (!priceRange) {
        displayProducts(allProducts);
        return;
    }
    
    let filtered;
    if (priceRange === '0-50') {
        filtered = allProducts.filter(p => p.price < 50);
    } else if (priceRange === '50-100') {
        filtered = allProducts.filter(p => p.price >= 50 && p.price <= 100);
    } else if (priceRange === '100+') {
        filtered = allProducts.filter(p => p.price > 100);
    }
    
    displayProducts(filtered);
}

// Customer lookup
async function lookupCustomer() {
    const email = document.getElementById('customer-email').value;
    
    if (!email) {
        alert('Please enter an email address');
        return;
    }
    
    try {
        const customer = await requestJson(`/customer?email=${encodeURIComponent(email)}`);
        
        const resultDiv = byId('customer-result');
        if (customer) {
            const card = makeElement('article', undefined, 'customer-info');
            card.append(
                makeElement('h3', `${displayValue(customer.first_name, '')} ${displayValue(customer.last_name, '')}`.trim()),
                makeElement('p', `Email: ${displayValue(customer.email)}`),
                makeElement('p', `Segment: ${displayValue(customer.customer_segment)}`),
                makeElement('p', `Lifetime value: ${money(customer.lifetime_value)}`),
                makeElement('p', `Status: ${displayValue(customer.status)}`),
                makeElement('p', `Member since: ${displayValue(customer.registration_date)}`)
            );
            resultDiv.replaceChildren(card);
        } else {
            showMessage(resultDiv, 'Customer not found.', true);
        }
    } catch (error) {
        console.error('Lookup failed:', error);
        showMessage(byId('customer-result'), error.message, true);
    }
}

// Analytics functions
async function loadAnalytics(query, title, columns) {
    const result = byId('analytics-result');
    showMessage(result, 'Running the selected database analysis…');
    try {
        const rows = await requestJson(`/analytics?query=${encodeURIComponent(query)}`);
        result.replaceChildren(renderTable(title, columns, rows));
    } catch (error) {
        console.error('Analytics failed:', error);
        showMessage(result, error.message, true);
    }
}

async function getTopProducts() {
    return loadAnalytics('top-products', 'Top 10 products by delivered revenue', [
        { label: 'Product', value: 'product_name' },
        { label: 'Category', value: 'category' },
        { label: 'Orders', value: 'order_count' },
        { label: 'Revenue', value: 'revenue', format: money }
    ]);
}

async function getCustomerSegments() {
    return loadAnalytics('segments', 'Active customer segments and delivered revenue', [
        { label: 'Segment', value: 'customer_segment' },
        { label: 'Customers', value: 'customer_count' },
        { label: 'Delivered orders', value: 'total_orders' },
        { label: 'Delivered revenue', value: 'actual_revenue', format: money }
    ]);
}

async function getRevenueByCategory() {
    return loadAnalytics('revenue', 'Delivered revenue by category', [
        { label: 'Category', value: 'category' },
        { label: 'Units sold', value: 'units_sold' },
        { label: 'Revenue', value: 'revenue', format: money }
    ]);
}

async function getOrderStatus() {
    return loadAnalytics('orders', 'Order status distribution', [
        { label: 'Status', value: 'order_status' },
        { label: 'Count', value: 'order_count' },
        { label: 'Order value', value: 'total_value', format: money }
    ]);
}
