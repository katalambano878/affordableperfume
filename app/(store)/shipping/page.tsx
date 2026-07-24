import Link from 'next/link';
import PageHero from '@/components/PageHero';

export default function ShippingPage() {
  const deliveryOptions = [
    {
      type: 'Delivery range (20-50 GHS) nationwide',
      time: '24 - 48 Hours',
      cost: '',
      description: 'Reliable delivery to your doorstep across Ghana',
      icon: 'ri-truck-line'
    },
    {
      type: 'Express Delivery',
      time: '',
      cost: '',
      description:
        'For same-day express delivery, kindly arrange a rider through Yango, Uber, or Bolt Delivery.',
      icon: 'ri-rocket-line'
    },
    {
      type: 'Store Pickup',
      time: 'Instant',
      cost: 'FREE',
      description: 'Collect from our Accra location immediately',
      icon: 'ri-store-2-line'
    }
  ];

  const expressDeliveryNote =
    'For same-day express delivery, kindly arrange a rider through Yango, Uber, or Bolt Delivery.';

  return (
    <div className="min-h-screen bg-white">
      <PageHero
        title="Shipping & Delivery"
        subtitle="Nationwide delivery in 24–48 hrs (GHS 20–50). Free standard shipping on orders over GHS 300."
        image="shipping"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Delivery Options</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {deliveryOptions.map((option, index) => (
              <div key={index} className="bg-white border-2 border-gray-200 p-8 rounded-2xl hover:border-blue-500 hover:shadow-lg transition-all">
                <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                  <i className={`${option.icon} text-2xl text-blue-700`}></i>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{option.type}</h3>
                {option.cost ? (
                  <div className="text-blue-700 font-bold text-xl mb-2">{option.cost}</div>
                ) : null}
                {option.time ? (
                  <div className="text-gray-600 font-medium mb-4">{option.time}</div>
                ) : null}
                <p className="text-gray-600 leading-relaxed">{option.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-8 mb-16 text-center">
          <div className="w-16 h-16 bg-blue-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-gift-line text-3xl text-white"></i>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">Free Standard Shipping</h3>
          <p className="text-lg text-gray-600">
            Spend GHS 300 or more and get <span className="font-bold text-blue-700">FREE standard delivery</span> anywhere in Ghana
          </p>
        </div>

        <div className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">Delivery Timeframes</h2>
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-200">
            <div className="p-8">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Standard delivery</h3>
              <p className="text-gray-600 leading-relaxed">
                Delivery takes 24–48 hrs nationwide.
              </p>
            </div>
            <div className="p-8">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Express delivery</h3>
              <p className="text-gray-600 leading-relaxed">{expressDeliveryNote}</p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-6">How Shipping Works</h2>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="font-bold text-blue-700">1</span>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">Order Processing</h3>
                  <p className="text-gray-600 leading-relaxed">
                    We confirm your order, carefully pack your items, and prepare them for dispatch. Standard
                    delivery takes 24–48 hrs nationwide (delivery fee typically GHS 20–50 depending on location).
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="font-bold text-blue-700">2</span>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">Dispatch</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Your order is handed to our trusted delivery partner. You&apos;ll receive your order details and
                    tracking information via email and SMS once it&apos;s on the way.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="font-bold text-blue-700">3</span>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">Track Your Order</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Use your order number and email on our{' '}
                    <Link href="/order-tracking" className="text-blue-700 font-medium hover:underline">
                      Order Tracking
                    </Link>{' '}
                    page to see status updates at each stage.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="font-bold text-blue-700">4</span>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">Delivery</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Delivery takes 24–48 hrs nationwide. Our partner may contact you before arrival—please keep your
                    phone reachable. Sign for your package and enjoy your purchase!
                  </p>
                  <p className="text-gray-600 leading-relaxed mt-3 text-sm">
                    <span className="font-semibold text-gray-900">Need it today?</span> {expressDeliveryNote}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Important Information</h2>
            <div className="bg-gray-50 rounded-2xl p-6 space-y-6">
              <div>
                <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <i className="ri-calendar-line text-blue-700"></i>
                  Business Days
                </h3>
                <p className="text-gray-600 leading-relaxed text-sm">
                  Mon–Friday, 9:00am to 5:00pm
                </p>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <i className="ri-phone-line text-blue-700"></i>
                  Delivery Contact
                </h3>
                <p className="text-gray-600 leading-relaxed text-sm">
                  Our delivery partner will call you before arrival. Please ensure your phone number is correct and reachable.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-8 mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Order Tracking</h2>
          <p className="text-gray-600 mb-6 leading-relaxed">
            Track your order anytime using your order number and email address. You'll see real-time updates including:
          </p>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="ri-checkbox-circle-line text-2xl text-blue-700"></i>
              </div>
              <p className="font-medium text-gray-900">Order Confirmed</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="ri-package-line text-2xl text-amber-700"></i>
              </div>
              <p className="font-medium text-gray-900">Processing</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="ri-truck-line text-2xl text-purple-700"></i>
              </div>
              <p className="font-medium text-gray-900">Out for Delivery</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="ri-gift-line text-2xl text-blue-700"></i>
              </div>
              <p className="font-medium text-gray-900">Delivered</p>
            </div>
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/order-tracking"
              className="inline-flex items-center gap-2 bg-blue-700 text-white px-8 py-4 rounded-full font-medium hover:bg-blue-800 transition-colors whitespace-nowrap"
            >
              <i className="ri-map-pin-line"></i>
              Track Your Order
            </Link>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-700 to-blue-900 rounded-2xl p-8 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">Need Help with Your Delivery?</h2>
          <p className="text-blue-100 mb-6 leading-relaxed">
            Questions about shipping costs, delivery times, or tracking? Our customer service team is here to help.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-white text-blue-700 px-6 py-3 rounded-full font-medium hover:bg-blue-50 transition-colors whitespace-nowrap"
            >
              Contact Support
            </Link>
            <Link
              href="/faqs"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-full font-medium hover:bg-blue-500 transition-colors whitespace-nowrap"
            >
              View FAQs
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
