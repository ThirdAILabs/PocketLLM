import { useState, FormEvent } from "react";
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useElements, useStripe } from '@stripe/react-stripe-js';

const stripePromise = loadStripe('pk_test_51Nc8ySAJoSOk3o2brkpENzEGlNJexoNMael8yRV3pxUeHBmiVNqg4tMimeHW0fNroRDILPY5OnGLkDH7CX69fVnO00eKYlLF8l')

type SubscribeProps = {
  trigger: React.RefObject<HTMLButtonElement>;
}

export default function Subscribe({trigger}: SubscribeProps) {
  // const [subscription, setSubscription] = useState(0); // 0 - no subscription, 1 - monthly, 2 - yearly
  const [subscription, _] = useState(0) // 0 - no subscription, 1 - monthly, 2 - yearly
  const [paymentType, setPaymentType] = useState(0) // 0 - don't, 1 - monthly, 2 - yearly

  const PaymentForm = () => {
    const stripe = useStripe()
    const elements = useElements()
  
    const handleSubmit = async (event: FormEvent) => {
      event.preventDefault();
  
      if (!stripe || !elements) {
        return;
      }
  
      const cardElement = elements.getElement(CardElement);
  
      if (!cardElement) {
        console.log('Card Element not found');
        return;
      }
  
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });
  
      if (error) {
        console.log('[error]', error);
        return;
      }
  
      if (paymentMethod && paymentMethod.id) {
        console.log(` paymentMethod.id: ${ paymentMethod.id}`)
        handleSubscription(paymentMethod.id)
      } else {
        console.log('Payment method creation failed');
      }
    };
  
    return (
      <form onSubmit={handleSubmit}>
        <CardElement />
        <button type="submit" disabled={!stripe}>Subscribe</button>
      </form>
    );
  };

  const handleSubscription = async (paymentMethodId: string) => {
    const stripe = await stripePromise;
    if (!stripe) {
      console.error('Stripe failed to initialize');
      return;
    }

    // Check if paymentType is valid
    if (paymentType === 0) {
      console.error('Invalid subscription type')
      // Handle the error - e.g., show a message to the user
      return
    }

    try {
      const response = await fetch('https://stripe-backend-endpoint-71a1560918ab.herokuapp.com/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentType: paymentType,
        }),
      });
  
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
  
      const paymentIntentResponse = await response.json();
  
      if (paymentMethodId === null) {
        return;
      }
  
      const { error } = await stripe.confirmCardPayment(paymentIntentResponse.clientSecret, {
        payment_method: paymentMethodId,
      });
  
      if (error) {
        console.error('Payment error:', error);
        // Handle additional error logic
      } else {
        console.log('Payment successful!');
        // Handle successful payment logic
      }
    } catch (error) {
      console.error('Error:', error);
      // Handle fetch errors
    }
  }

  return (
    <>
        <button ref={trigger} type="button" className='btn btn-general mx-1'  
          data-bs-toggle="modal" data-bs-target="#subscribeModal"
          style={{display: "none"}}
        >
            <div className='font-sm'>Subscription</div>
        </button>


        <div className="modal fade" id="subscribeModal" tabIndex={-1} aria-hidden="true">
            <div className="modal-dialog modal-lg modal-dialog-centered">
                <div className="modal-content">
                    <div className="modal-header border-0">
                        <button type="button" className="btn-close modal-close-btn" data-bs-dismiss="modal" aria-label="Close" 
                          onClick={()=>{setTimeout(() => {setPaymentType(0)}, 2000)}}>
                        </button>
                    </div>
                    <div className="modal-body pt-0 font-sm">
                    {
                      paymentType !== 0
                      ?
                      <>
                        {/* Show user the amount of payment they are about to make */}
                        <Elements stripe={stripePromise}>
                          <PaymentForm/>
                        </Elements>
                      </>
                      :
                      <>
                        <div className='fs-6 mb-3'>
                          {
                            subscription == 0 ?
                            <>Unlock ... with subscription</>
                            :
                            <>Enjoying ... benefits</>
                          }
                          
                        </div>

                        <div className='d-flex mb-3'>
                          <div className='subscribe-frame mx-2 border-shadow border border-light-subtle text-start d-flex flex-column justify-content-between'>
                            <div>
                              <div className='pb-3'>Monthly Plan</div>
                              
                              <div className='d-flex fs-6 align-items-end mb-2'><div className='fs-3 me-1 fw-bold'>9.99</div> /month</div>
                              <div className='mb-2'>description la lafafdaldfalfdajfdahfehakj alafjas ofpoewakjafdauehf</div>
                              <div>
                                <div className='d-flex align-items-start'>
                                  <i className="bi bi-check-lg text-info fs-4 mx-2"></i>
                                  <div className='mt-2'>good point 1 alabfaseofasefhad faeasfeafadfasefafasfeafdava</div>
                                </div>
                                <div className='d-flex align-items-start'>
                                  <i className="bi bi-check-lg text-info fs-4 mx-2"></i>
                                  <div className='mt-2'>good point 2 alabfaseofasefhad faeasfeafadfasefafasfeafdava</div>
                                </div>
                              </div>
                            </div>
                            
                            <div className='d-flex justify-content-center my-2 mt-5'>
                              <button type="button"
                                      className='btn bg-primary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1'
                                      onClick={()=>setPaymentType(1)}>
                                        Subsribe
                              </button>
                            </div>
                          </div>

                          <div className='subscribe-frame mx-2 border-shadow border border-light-subtle text-start d-flex flex-column justify-content-between'>
                            <div className='position-relative'>
                              <div className='pb-3'>Yearly Plan</div>
                              
                              <div className='d-flex fs-6 align-items-end mb-2'><div className='fs-3 me-1 fw-bold'>99.99</div> /year</div>
                              <div className='mb-2'>description la lafafdaldfalfdajfdahfehakjn; ;alafjas ofpoewakjafdauehf</div>
                              <div>
                                <div className='d-flex align-items-start'>
                                  <i className="bi bi-check-lg text-info fs-4 mx-2"></i>
                                  <div className='mt-2'>good point 1 alabfaseofasefhad faeasfeafadfasefafasfeafdava</div>
                                </div>
                                <div className='d-flex align-items-start'>
                                  <i className="bi bi-check-lg text-info fs-4 mx-2"></i>
                                  <div className='mt-2'>good point 2 alabfaseofasefhad faeasfeafadfasefafasfeafdava</div>
                                </div>
                                <div className='d-flex align-items-start'>
                                  <i className="bi bi-check-lg text-info fs-4 mx-2"></i>
                                  <div className='mt-2'>good point 3 alabfaseofasefhad faeasfeafadfasefafasfeafdava</div>
                                </div>
                              </div>
                              <div className='subcribe-save text-success fs-6'>Save $20</div>
                            </div>
                            
                            <div className='d-flex justify-content-center my-2 mt-5'>
                              <button className='btn bg-primary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1'
                                      onClick={()=>setPaymentType(2)}>
                                  Subscribe
                              </button>
                            </div>
                            
                          </div>
                        </div>
                      </>
                    }
                       
                    </div>
                </div>
            </div>
          </div>
    </>
  )
}
