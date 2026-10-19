// Hand-written skeleton for ProductCard. Drifted: the real card got a rating
// row and an "Add to cart" button; nobody updated this.
export function ProductCardSkeleton() {
  return (
    <div className="product-card">
      <div className="sk sk-block" style={{ aspectRatio: "1", width: "100%" }} />
      <div className="product-body">
        <div className="sk sk-line" style={{ width: "70%" }} />
        <div className="sk sk-line" style={{ width: "30%", marginTop: 8 }} />
      </div>
    </div>
  );
}

export function ProductGridSkeleton() {
  return (
    <div className="product-grid">
      {Array.from({ length: 6 }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
