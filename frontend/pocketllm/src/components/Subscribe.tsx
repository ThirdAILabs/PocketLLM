import { useState, FormEvent, useContext } from "react";
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import SpecifyPaymentNotice from "./SpecifyPaymentNotice";
import { SubscriptionPlan } from '../App'
import { SetAlertMessageContext } from '../contexts/SetAlertMessageContext';
import stripeLogo from "../assets/stripe.png";
import { Tooltip } from "@mui/material";

const stripePromise = loadStripe('pk_live_51O25b4E7soCP48YBHZshJy5P2LBBoKxdmohhpWXt0vHqQr9wXj1c729heMtDNCLghWUWO30yp6ubJqGuRgoreZlY00f9C88gFs')

type SubscribeProps = {
  trigger: React.RefObject<HTMLButtonElement>;
  user : { email: string, name: string, subscription_plan: SubscriptionPlan  } | null,
  setUser: React.Dispatch<React.SetStateAction<{ email: string, name: string, subscription_plan: SubscriptionPlan  } | null>>,
  setOpen: React.Dispatch<React.SetStateAction<boolean>>,
}

export default function Subscribe({trigger, user, setUser, setOpen}: SubscribeProps) {
  const [paymentType, setPaymentType] = useState(0) // 0 - don't, 1 - monthly, 2 - yearly

  const [notice, setNotice] = useState(<></>);

  const setAlertMessage = useContext(SetAlertMessageContext)

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
        setAlertMessage('Stripe is not loaded correctly. Please restart app and try again.')
        return;
      }
  
      const cardElement = elements.getElement(CardElement);
  
      if (!cardElement) {
        console.log('Card Element not found');
        setAlertMessage('Card Element not found. Please restart app and try again.')
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
      <form onSubmit={handleSubmit} className="m-4 mt-3">
        <div className="d-flex align-items-center mb-4">Powered by 
          <img src={stripeLogo} placeholder="Stripe Logo" style={{width: "60px"}}/>
        </div>
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
      setAlertMessage('Stripe failed to initialize. Please restart app and try again.')
      return;
    }

    // Check if paymentType is valid
    if (paymentType === 0) {
      console.error('Invalid subscription type')
      setAlertMessage('Invalid subscription type. Please restart app and try again.')
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
    {
      user ?
      <>
      <div className='px-2 my-2'>
            <button  ref={trigger} type="button" data-bs-toggle="modal" data-bs-target="#subscribeModal" 
            onClick={()=>setOpen(false)}
            className='font-sm text-start btn btn-general2 bg-transparent rounded-3 py-2 w-100 d-flex'>
                <i className="bi bi-credit-card text-secondary me-2"></i>
                Subscribe
            </button>
        </div>

        <div className="modal fade" id="subscribeModal" tabIndex={-1} aria-hidden="true">
            <div className="modal-dialog modal-lg modal-dialog-centered">
                <div className="modal-content">
                    <div className="modal-header border-0">
                          <button type="button" className="btn-close modal-close-btn" data-bs-dismiss="modal" aria-label="Close" 
                            onClick={()=>{setTimeout(() => {setPaymentType(0)}, 2000)}}>
                          </button>
                    </div>
                    <div className="modal-body py-3 font-sm">
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
                                        <div className='mt-2'>Complete privacy of your data</div>
                                      </div>
                                      <div className='d-flex align-items-start'>
                                        <i className="bi bi-check-lg text-info fs-4 mx-2"></i>
                                        <div className='mt-2'>200 MB monthly premium credit</div>
                                      </div>
                                      <div className='d-flex align-items-start'>
                                        <i className="bi bi-check-lg text-info fs-4 mx-2"></i>
                                        <div className='mt-2'>Unlimited PDF, URL search</div>
                                      </div>
                                      <div className='d-flex align-items-start'>
                                        <i className="bi bi-dot fs-4 mx-2 text-secondary"></i>
                                        <div className='mt-2'>Limited Gmail, Outlook search</div>
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
                                        <div className='mt-2'>Complete privacy of your data</div>
                                      </div>
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
                                        <div className='mt-2'>Unlimited Outlook workspace search</div>
                                      </div>
                                      <div className='d-flex align-items-start'>
                                        <i className="bi bi-dot fs-4 mx-2 text-secondary"></i>
                                        <div className='mt-2'>Unlimited Github workspace search (upcoming)</div>
                                      </div>
                                      <div className='d-flex align-items-start'>
                                        <i className="bi bi-dot fs-4 mx-2 text-secondary"></i>
                                        <div className='mt-2'>Unlimited Slack workspace search (upcoming)</div>
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
                                                  Cancel
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
                              </div>
                            </>
                          }
                       
                          <div className="font-sm mt-4 text-secondary">Have questions? Reach us at contact@thirdai.com</div>
                    </div>
                    {notice}
                </div>
            </div>
        </div>
      </>
      :
      <div className='px-2 my-2'>
        <Tooltip title="Please login first" placement="right">
          <button  type="button"  onClick={(e)=>e.preventDefault()}
            style={{opacity: 0.5}}
            className='font-sm border-0 text-start btn btn-general2 bg-transparent rounded-3 py-2 w-100 d-flex'>
              <i className="bi bi-credit-card text-secondary me-2"></i>
              Subscribe
          </button>
        </Tooltip>
      </div>
    }
        
    </>
  )
}
