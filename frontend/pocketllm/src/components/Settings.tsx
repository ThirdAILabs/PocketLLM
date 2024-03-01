import React from 'react'
import { styled } from '@mui/system';
import { Tabs as BaseTabs } from '@mui/base/Tabs';
import { TabsList as BaseTabsList } from '@mui/base/TabsList';
import { TabPanel as BaseTabPanel } from '@mui/base/TabPanel';
import { buttonClasses } from '@mui/base/Button';
import { Tab as BaseTab, tabClasses } from '@mui/base/Tab';
import { Tooltip } from "@mui/material";
import { SubscriptionPlan } from '../App'
import ProgressBar from './ProgressBar';

const calculateDaysLeft = (endDate: Date) => {
  if (!endDate) return 0;

  const today = new Date();
  const timeDiff = endDate.getTime() - today.getTime();
  const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));

  return Math.max(daysLeft, 0); // Ensure it doesn't go negative
}

type SettingsProps = {
    trigger: React.RefObject<HTMLButtonElement>;
    user : { email: string, name: string, subscription_plan: SubscriptionPlan  } | null,
    premiumEndDate: Date | null, setPremiumEndDate: React.Dispatch<React.SetStateAction<Date | null>>, currentUsage: number
}

export default function Settings({trigger, user, premiumEndDate, setPremiumEndDate, currentUsage}: SettingsProps) {
  return (
    <>
        <div className='px-2 my-1'>
            <button  ref={trigger} type="button" data-bs-toggle="modal" data-bs-target="#settingsModal"
            className='font-sm text-start btn btn-general2 bg-transparent rounded-3 py-2 w-100 d-flex align-items-center'>
                <i className="bi bi-gear text-secondary me-3 fs-6"></i>
                Account info
            </button>
        </div>

        <div className="modal fade" id="settingsModal" tabIndex={-1} aria-hidden="true">
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                    <div className="modal-header border-0">
                          <button type="button" className="btn-close modal-close-btn" data-bs-dismiss="modal" aria-label="Close" 
                            >
                          </button>
                    </div>
                    <div className="modal-body p-0 py-3 font-sm">
                        <Tabs defaultValue={0} orientation="vertical">
                          <TabsList>
                              <Tab>Account usage</Tab>
                              <Tab>Referral</Tab>
                          </TabsList>

                          {
                            user && user.subscription_plan !== SubscriptionPlan.FREE
                            ?
                            <TabPanel value={0}>
                              <div className='mx-2 mt-3 pb-1 mb-1 text-start w-100'>
                                Thanks for subscribing!
                              </div>
                            </TabPanel>
                            :
                            <TabPanel value={0}>
                              <div className='mx-2 mt-3 pb-1 mb-1 text-start w-100'>
                                  <div className='d-flex align-items-start'>
                                      {
                                          premiumEndDate && new Date() <= premiumEndDate 
                                          ?
                                          <div className='font-x-sm mb-1 ms-3'>
                                              Premium days left: {calculateDaysLeft(premiumEndDate)}
                                          </div>
                                          :
                                          <>
                                              <div className='font-x-sm mb-1 ms-3'>Monthly Premium Credits left: {200 - Math.floor(Math.min(currentUsage, 200))}mb</div>
                                              <Tooltip title="Free-tier users get 200mbs of premium plan usage at the beginning of every month." placement="right">
                                                  <i className="bi bi-question-circle p-0 font-x-sm ms-1 cursor-pointer text-primary text-opacity-75"></i>
                                              </Tooltip>
                                          </>
                                      }
                                  </div>

                                  {
                                      premiumEndDate && new Date() <= premiumEndDate 
                                      ?
                                      <></>
                                      :
                                      <div style={{width: "250px"}}>
                                        <ProgressBar
                                          progress={Math.floor(Math.min(currentUsage / 200 * 100, 100))} 
                                          color={Math.floor(currentUsage / 200 * 100) < 90 ? "secondary bg-opacity-50" : "warning bg-opacity-50"}
                                        />
                                    </div>
                                  }
                              </div>
                            </TabPanel>
                          }


                          <TabPanel value={1}>Second page</TabPanel>
                        </Tabs>
                    </div>
                </div>
            </div>
        </div>
    </>
  )
}

const blue = {
    50: '#F0F7FF',
    100: '#C2E0FF',
    200: '#80BFFF',
    300: '#66B2FF',
    400: '#3399FF',
    500: '#007FFF',
    600: '#0072E5',
    700: '#0059B2',
    800: '#004C99',
    900: '#003A75',
  };
  
  const grey = {
    50: 'rgb(242, 242, 242)',
    100: 'rgb(230, 230, 230)',
    200: '#DAE2ED',
    300: '#C7D0DD',
    400: '#B0B8C4',
    500: '#9DA8B7',
    600: '#6B7A90',
    700: '#434D5B',
    800: '#303740',
    900: '#1C2025',
  };
  
  const Tab = styled(BaseTab)`
    color: black;
    cursor: pointer;
    font-size: 0.875rem;
    background-color: transparent;
    width: 100%;
    padding: 12px;
    border: none;
    border-radius: 7px;
    display: flex;
    justify-content: center;
    transition: all 0.5s ease;
  
    &:hover {
      background-color: ${grey[50]};
    }
  
    &:focus {
      color: #fff;
      outline: 3px solid ${blue[200]};
    }
  
    &.${buttonClasses.focusVisible} {
      background-color: #fff;
      color: ${grey[900]};
    }
  
    &.${tabClasses.disabled} {
      opacity: 0.5;
    }
  
    &.${tabClasses.selected} {
      background-color: ${grey[100]};
      color: black;
    }
  `;
  
  const TabPanel = styled(BaseTabPanel)`
    width: 100%;
    font-size: 0.875rem;
  `;
  
  const Tabs = styled(BaseTabs)`
    display: flex;
    gap: 16px;
    width: 200px;
  `;
  
  const TabsList = styled(BaseTabsList)(
    ({}) => `
    min-width: 170px;
    height: 100%;
    background-color: transparent;
    border-right: solid 2px #f1f1f1;
    display: flex;
    padding: 10px;
    gap: 12px;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    align-content: space-between;
    `,
  );
