import { useState } from 'react';
import { ArrowRightIcon, PackageIcon } from '@phosphor-icons/react';
import TemuInspector from '@components/TemuInspector';
import { useCurrency } from '@/context/CurrencyContext';

export default function LandingProductReview({ onContinue }) {
  const { formatMoney } = useCurrency();
  const [product, setProduct] = useState(null);
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const variants = product?.variants ?? [];
  const variant = variants.find((option) => option.id === variantId);
  const total = variant ? Math.round(variant.priceUsd * 100) * quantity / 100 : null;
  const startingPrice = variants.length
    ? Math.min(...variants.map((option) => option.priceUsd))
    : product?.priceUsd;

  return (
    <section className="tsb-product-review tsb-wrap" aria-labelledby="product-review-title">
      <div>
        <h2 id="product-review-title">What’s on your wishlist?</h2>
        <p>Check the item price, then sign in to see your stake range.</p>
      </div>
      <TemuInspector
        userDepositBalance={0}
        onLoadingChange={(loading) => { if (loading) setProduct(null); }}
        onSelectProduct={(item) => {
          setProduct(item);
          setVariantId(item.variants?.length === 1 ? item.variants[0].id : '');
          setQuantity(1);
        }}
      />
      {product && (
        <div className="tsb-product-result">
          <div className="tsb-result-image">
            <PackageIcon size={40} aria-hidden="true" />
            {product.imageUrl && <img src={product.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer"
              onError={(event) => { event.currentTarget.hidden = true; }} />}
          </div>
          <div className="tsb-result-detail">
            <h3>{product.title}</h3>
            <p>{!variant && variants.some((option) => option.priceUsd !== startingPrice) && 'From '}
              {formatMoney(variant?.priceUsd ?? startingPrice)} per item
            </p>
            {variants.length > 1 && (
              <label>
                Product option
                <select value={variantId} onChange={(event) => { setVariantId(event.target.value); setQuantity(1); }}>
                  <option value="">Select an option</option>
                  {variants.map((option) => (
                    <option key={option.id} value={option.id}>
                      {Object.entries(option.options).map(([name, value]) => `${name}: ${value}`).join(' / ')} · {formatMoney(option.priceUsd)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {variant && (
              <>
                {variants.length === 1 && <p>{Object.entries(variant.options).map(([name, value]) => `${name}: ${value}`).join(' / ')}</p>}
                <label>
                  Quantity
                  <select value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}>
                    {Array.from({ length: variant.maxQuantity }, (_, index) => (
                      <option key={index + 1} value={index + 1}>{index + 1}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <div className="tsb-result-quote" aria-live="polite">
              {variants.length > 0 ? (
                <dl>
                  <div><dt>{variant ? 'Item total' : 'Item total from'}</dt><dd>{formatMoney(total ?? startingPrice)}</dd></div>
                </dl>
              ) : <p>There are no verified options available for this item.</p>}
            </div>
            {variant && variants.length > 0 && <button type="button" className="tsb-text-link" onClick={onContinue}>Sign in to play <ArrowRightIcon size={18} /></button>}
          </div>
        </div>
      )}
    </section>
  );
}
