import { events } from '@dropins/tools/event-bus.js';
import { render as provider } from '@dropins/storefront-cart/render.js';
import * as Cart from '@dropins/storefront-cart/api.js';

// Dropin Containers
import CartSummaryList from '@dropins/storefront-cart/containers/CartSummaryList.js';
import OrderSummary from '@dropins/storefront-cart/containers/OrderSummary.js';
import EstimateShipping from '@dropins/storefront-cart/containers/EstimateShipping.js';
import EmptyCart from '@dropins/storefront-cart/containers/EmptyCart.js';
import Coupons from '@dropins/storefront-cart/containers/Coupons.js';

// API
import { publishShoppingCartViewEvent } from '@dropins/storefront-cart/api.js';

// Initializers
import '../../scripts/initializers/cart.js';

import { readBlockConfig } from '../../scripts/aem.js';

export default async function decorate(block) {
  // Configuration
  const {
    'hide-heading': hideHeading = 'false',
    'max-items': maxItems,
    'hide-attributes': hideAttributes = '',
    'enable-item-quantity-update': enableUpdateItemQuantity = 'false',
    'enable-item-remove': enableRemoveItem = 'true',
    'enable-estimate-shipping': enableEstimateShipping = 'false',
    'start-shopping-url': startShoppingURL = '',
    'checkout-url': checkoutURL = '',
  } = readBlockConfig(block);

  const cart = Cart.getCartDataFromCache();

  const isEmptyCart = isCartEmpty(cart);

  // Layout
  const fragment = document.createRange().createContextualFragment(`
    <div class="cart__wrapper">
      <div class="cart__left-column">
        <div class="cart__list"></div>
      </div>
      <div class="cart__right-column">
        <div class="cart__order-summary"></div>
      </div>
    </div>

    <div class="cart__empty-cart"></div>
  `);

  const $wrapper = fragment.querySelector('.cart__wrapper');
  const $list = fragment.querySelector('.cart__list');
  const $summary = fragment.querySelector('.cart__order-summary');
  const $emptyCart = fragment.querySelector('.cart__empty-cart');

  block.innerHTML = '';
  block.appendChild(fragment);

  // Toggle Empty Cart
  function toggleEmptyCart(state) {
    if (state) {
      $wrapper.setAttribute('hidden', '');
      $emptyCart.removeAttribute('hidden');
    } else {
      $wrapper.removeAttribute('hidden');
      $emptyCart.setAttribute('hidden', '');
    }
  }

  toggleEmptyCart(isEmptyCart);

  // Render Containers
  await Promise.all([
    // Cart List
    provider.render(CartSummaryList, {
      hideHeading: hideHeading === 'true',
      routeProduct: (product) => `/products/${product.url.urlKey}/${product.topLevelSku}`,
      routeEmptyCartCTA: startShoppingURL ? () => startShoppingURL : undefined,
      maxItems: parseInt(maxItems, 10) || undefined,
      attributesToHide: hideAttributes.split(',').map((attr) => attr.trim().toLowerCase()),
      enableUpdateItemQuantity: enableUpdateItemQuantity === 'true',
      enableRemoveItem: enableRemoveItem === 'true',
      slots: {
        ProductAttributes: (ctx) => {
          const productAttributes = document.createElement('div');
          productAttributes.className = 'product-attributes';

          // Create categories section
          if (ctx.item && ctx.item.categories && ctx.item.categories.length > 0) {
            const categoryIcons = {
              All: '🌍',
              Office: '📁',
              Apparel: '👕',
              Bags: '🎒',
              Collections: '🖼️',
              Lifestyle: '🌟',
              Tech: '💻',
              Gifts: '🎁',
              Travel: '✈️',
            };

            const categoryElements = ctx.item.categories.map((category) => {
              const categoryName = category;
              const categoryIcon = categoryIcons[categoryName] || '🌍';
              return `<div class="product-attribute-category">${categoryIcon} ${categoryName}</div>`;
            });

            productAttributes.innerHTML = categoryElements.join('');

            // Add some basic styles
            const style = document.createElement('style');
            style.textContent = `
              .product-attributes {
              padding: 10px;
              margin: 10px 0;
              }
              .product-attribute-category {
              display: inline-block;
              margin: 5px;
              padding: 5px 10px;
              background: #f5f5f5;
              border-radius: 15px;
              font-size: 0.9em;
              }
          `;
            productAttributes.appendChild(style);
          }

          ctx.appendChild(productAttributes);
        },
      },
    })($list),

    // Order Summary
    provider.render(OrderSummary, {
      routeProduct: (product) => `/products/${product.url.urlKey}/${product.topLevelSku}`,
      routeCheckout: checkoutURL ? () => checkoutURL : undefined,
      slots: {
        EstimateShipping: async (ctx) => {
          if (enableEstimateShipping === 'true') {
            const wrapper = document.createElement('div');
            await provider.render(EstimateShipping, {})(wrapper);
            ctx.replaceWith(wrapper);
          }
        },
        Coupons: (ctx) => {
          const coupons = document.createElement('div');

          provider.render(Coupons)(coupons);

          ctx.appendChild(coupons);
        },
      },
    })($summary),

    // Empty Cart
    provider.render(EmptyCart, {
      routeCTA: startShoppingURL ? () => startShoppingURL : undefined,
    })($emptyCart),
  ]);

  let cartViewEventPublished = false;
  // Events
  events.on('cart/data', (payload) => {
    toggleEmptyCart(isCartEmpty(payload));

    if (!cartViewEventPublished) {
      cartViewEventPublished = true;
      publishShoppingCartViewEvent();
    }
  }, { eager: true });

  return Promise.resolve();
}

function isCartEmpty(cart) {
  return cart ? cart.totalQuantity < 1 : true;
}
