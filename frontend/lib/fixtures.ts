import productsData from '../mocks/fixtures/products.json';
import ordersData from '../mocks/fixtures/orders.json';
import customersData from '../mocks/fixtures/customers.json';
import documentsData from '../mocks/fixtures/documents.json';
import inventoryData from '../mocks/fixtures/inventory-items.json';

export type Product = (typeof productsData)[number];
export type Order = (typeof ordersData)[number];
export type OrderItem = Order['items'][number];
export type Customer = (typeof customersData)[number];
export type Document = (typeof documentsData)[number];
export type InventoryItem = (typeof inventoryData)[number];

export const products: Product[] = productsData;
export const orders: Order[] = ordersData;
export const customers: Customer[] = customersData;
export const documents: Document[] = documentsData;
export const inventoryItems: InventoryItem[] = inventoryData;

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug);
}

export function getProductById(id: string): Product | undefined {
  return products.find((product) => product.id === id);
}

export function getCustomerById(id: string): Customer | undefined {
  return customers.find((customer) => customer.id === id);
}
