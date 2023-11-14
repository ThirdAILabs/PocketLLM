import { useState, FormEvent } from "react";
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import SpecifyPaymentNotice from "./SpecifyPaymentNotice";
import { SubscriptionPlan } from '../App'

const stripePromise = loadStripe('pk_live_51O25b4E7soCP48YBHZshJy5P2LBBoKxdmohhpWXt0vHqQr9wXj1c729heMtDNCLghWUWO30yp6ubJqGuRgoreZlY00f9C88gFs')

type SubscribeProps = {
  trigger: React.RefObject<HTMLButtonElement>;
  user : { email: string, name: string, subscription_plan: SubscriptionPlan  } | null,
  setUser: React.Dispatch<React.SetStateAction<{ email: string, name: string, subscription_plan: SubscriptionPlan  } | null>>,
}

export default function Subscribe({trigger, user, setUser}: SubscribeProps) {
  const [paymentType, setPaymentType] = useState(0) // 0 - don't, 1 - monthly, 2 - yearly

  const [notice, setNotice] = useState(<></>);

  // giveNotice("sucess", "Subscribed. You've unlocked the premium features.")
  function giveNotice(noticeType: String, noticeInfo: String) {
      setNotice(
          <SpecifyPaymentNotice noticeType={noticeType} noticeInfo={noticeInfo}/>
      )
      setTimeout(()=>{
          setNotice(<></>);
      }, 1500)
  }

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
        giveNotice("warning", "Card declined")
        console.log('[error]', error);
        return;
      }
  
      if (paymentMethod && paymentMethod.id) {
        console.log(` paymentMethod.id: ${ paymentMethod.id}`)
        handleSubscription(paymentMethod.id)
      } else {
        giveNotice("warning", "Subscription failed")
        console.log('Payment method creation failed');
      }
    };
  
    return (
      <form onSubmit={handleSubmit} className="m-4">
        <CardElement/>
        <div className="d-flex mt-5 justify-content-center">
          <button className="btn btn-general bg-secondary bg-opacity-25 font-sm me-2" type="button" onClick={()=>setPaymentType(0)}>Back</button>
          <button className="btn btn-general bg-primary bg-opacity-25 font-sm" type="submit" disabled={!stripe}>Pay now · {`${paymentType === 1 ? '$4.95' : '$9.99'}`}</button>
        </div>
        
      </form>
    );
  };
  

  const handleSubscription = async (paymentMethodId: string) => {
    setNotice(
      <SpecifyPaymentNotice noticeType={"loading"} noticeInfo={"Processing..."}/>
    )
    
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
          const response = await fetch('https://stripe-backend-endpoint-71a1560918ab.herokuapp.com/create-customer-and-subscribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              paymentType: paymentType,
              email: user?.email,
              paymentMethodId: paymentMethodId,
            }),
          });
      
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
      
          const subscriptionResponse = await response.json();
          
          if (subscriptionResponse.error) {
              console.error('Subscription error:', subscriptionResponse.error);
              giveNotice("warning", "Subscription failed")
          } else if (subscriptionResponse.success) {
              console.log('Payment successful and subscription created!')
              giveNotice("sucess", "Subscribed.")

              if (paymentType === 1) {
                setUser(prevUser => {
                  if (!prevUser) return null
                  
                  return {
                  ...prevUser,
                  active: true,
                  subscription_plan: SubscriptionPlan.PREMIUM
                  }
                })
              } else if (paymentType === 2) {
                setUser(prevUser => {
                  if (!prevUser) return null
                  
                  return {
                  ...prevUser,
                  active: true,
                  subscription_plan: SubscriptionPlan.SUPREME
                  }
                })
              }
          } else {
            console.error('Subscription status is incomplete or pending')
            giveNotice("warning", "Subscription incomplete")
          }
      } catch (error) {
        console.error('Error:', error);
        giveNotice("warning", "Subscription failed")
      }
  }

  return (
    <>
        <button ref={trigger} type="button" className='btn btn-general mx-1 mt-5'  
          data-bs-toggle="modal" data-bs-target="#subscribeModal"
          style={{display: "none"}}
        >
            <div className='font-sm'>Subscription</div>
        </button>


        <div className="modal fade" id="subscribeModal" tabIndex={-1} aria-hidden="true">
            <div className="modal-dialog modal-xl modal-dialog-centered">
                <div className="modal-content">
                    <div className="modal-header border-0">
                        <button type="button" className="btn-close modal-close-btn" data-bs-dismiss="modal" aria-label="Close" 
                          onClick={()=>{setTimeout(() => {setPaymentType(0)}, 2000)}}>
                        </button>
                    </div>
                    <div className="modal-body py-5 font-sm">
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
                        <div className='d-flex mb-3 justify-content-center px-4'>
                          <div className='subscribe-frame mx-2 border-shadow border border-light-subtle text-start d-flex flex-column justify-content-between'>
                            <div>
                              <div className='pb-3'>Free Plan</div>
                              
                              <div className='d-flex fs-6 align-items-end mb-2'><div className='fs-3 me-1 fw-bold'>0$</div></div>
                              <div>
                                <div className='d-flex align-items-start'>
                                  <i className="bi bi-check-lg text-info fs-4 mx-2"></i>
                                  <div className='mt-2'>200 MB workspace per month</div>
                                </div>
                                <div className='d-flex align-items-start'>
                                  <i className="bi bi-dot fs-4 mx-2 text-secondary"></i>
                                  <div className='mt-2'>Limited access to PDF URL Gmail workspace</div>
                                </div>
                                <div className='d-flex align-items-start'>
                                  <i className="bi bi-dot fs-4 mx-2 text-secondary"></i>
                                  <div className='mt-2'>OpenAI key not included</div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className='subscribe-frame mx-2 border-shadow border border-light-subtle text-start d-flex flex-column justify-content-between'>
                            <div>
                              <div className='pb-3'>Premium Plan</div>
                              
                              <div className='d-flex fs-6 align-items-end mb-2'><div className='fs-3 me-1 fw-bold'>4.95$</div> /month</div>
                              <div>
                                <div className='d-flex align-items-start'>
                                  <i className="bi bi-check-lg text-info fs-4 mx-2"></i>
                                  <div className='mt-2'>Unlimited PDF workspace search</div>
                                </div>
                                <div className='d-flex align-items-start'>
                                  <i className="bi bi-check-lg text-info fs-4 mx-2"></i>
                                  <div className='mt-2'>Unlimited URL workspace search</div>
                                </div>
                                <div className='d-flex align-items-start'>
                                  <i className="bi bi-check-lg text-info fs-4 mx-2"></i>
                                  <div className='mt-2'>Unlimited Gmail workspace search</div>
                                </div>
                                <div className='d-flex align-items-start'>
                                  <i className="bi bi-dot fs-4 mx-2 text-secondary"></i>
                                  <div className='mt-2'>OpenAI key not included</div>
                                </div>
                              </div>
                            </div>
                            
                            <div className='d-flex justify-content-center my-2 mt-5'>
                              {
                                (!user || (user && user.subscription_plan === SubscriptionPlan.FREE)) ?
                                <button type="button"
                                        className='btn bg-primary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1'
                                        onClick={()=>setPaymentType(1)}>
                                          Subscribe
                                </button>
                                :
                                user.subscription_plan ==  SubscriptionPlan.PREMIUM ?
                                <div>
                                  <div className='btn bg-info bg-opacity-25 btn-sm grey-btn px-3 rounded-3 mx-1' style={{cursor: "default"}}>
                                            Subscribed
                                  </div>
                                </div>
                                
                                :
                                <button type="button"
                                        className='btn bg-primary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1'
                                        onClick={()=>setPaymentType(1)}
                                >
                                          Switch plan
                                </button>
                              }
                              
                            </div>
                          </div>

                          {/* <div className='subscribe-frame mx-2 border-shadow border border-light-subtle text-start d-flex flex-column justify-content-between'>
                            <div className='position-relative'>
                              <div className='pb-3'>Supreme Plan</div>
                              
                              <div className='d-flex fs-6 align-items-end mb-2'><div className='fs-3 me-1 fw-bold'>9.99$</div> /month</div>
                              <div className='mb-2'></div>
                              <div>
                              <div className='d-flex align-items-start'>
                                  <i className="bi bi-check-lg text-info fs-4 mx-2"></i>
                                  <div className='mt-2'>Unlimited PDF workspace search</div>
                                </div>
                                <div className='d-flex align-items-start'>
                                  <i className="bi bi-check-lg text-info fs-4 mx-2"></i>
                                  <div className='mt-2'>Unlimited URL workspace search</div>
                                </div>
                                <div className='d-flex align-items-start'>
                                  <i className="bi bi-check-lg text-info fs-4 mx-2"></i>
                                  <div className='mt-2'>Unlimited Gmail workspace search</div>
                                </div>
                                <div className='d-flex align-items-start'>
                                  <i className="bi bi-check-lg text-info fs-4 mx-2"></i>
                                  <div className='mt-2'>OpenAI key included</div>
                                </div>
                                <div className='d-flex align-items-start'>
                                  <i className="bi bi-check-lg text-info fs-4 mx-2"></i>
                                  <div className='mt-2'>Early Beta access to new workspace</div>
                                </div>
                              </div>
                            </div>
                            
                            <div className='d-flex justify-content-center my-2 mt-5'>
                            {
                                (!user || (user && user.subscription_plan === SubscriptionPlan.FREE)) ?
                                <button type="button"
                                        className='btn bg-primary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1'
                                        onClick={()=>setPaymentType(2)}>
                                          Subscribe
                                </button>
                                :
                                user.subscription_plan ==  SubscriptionPlan.SUPREME ?
                                <div>
                                  <div className='btn bg-info bg-opacity-25 btn-sm grey-btn px-3 rounded-3 mx-1' style={{cursor: "default"}}>
                                            Subscribed
                                  </div>
                                </div>
                                
                                :
                                <button type="button"
                                        className='btn bg-primary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1'
                                        onClick={()=>setPaymentType(2)}
                                >
                                          Switch plan
                                </button>
                              }
                            </div>
                            
                          </div> */}
                        </div>
                      </>
                    }
                       
                    </div>
                    {notice}
                </div>
            </div>
          </div>
    </>
  )
}
