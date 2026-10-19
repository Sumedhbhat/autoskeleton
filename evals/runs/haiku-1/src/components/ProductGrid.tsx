import { fake } from "autoskeleton";
import type { Product } from "../api";

export const PRODUCTS_PLACEHOLDER: Product[] = fake.list(6, (i) => ({
  id: fake.id(i),
  name: fake.sentence(2, i),
  price: "$00.00",
  imageUrl: fake.image(400, 400),
  rating: 4,
  reviewCount: 20,
}));

export function ProductCard({ product }: { product: Product }) {
  return (
    <div className="product-card">
      <img src={product.imageUrl} alt="" className="product-image" />
      <div className="product-body">
        <div className="product-name">{product.name}</div>
        <div className="product-meta">
          <span className="stars">{"★".repeat(Math.round(product.rating))}</span>
          <span className="muted">({product.reviewCount})</span>
        </div>
        <div className="product-price">{product.price}</div>
        <button className="btn">Add to cart</button>
      </div>
    </div>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="product-grid">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
