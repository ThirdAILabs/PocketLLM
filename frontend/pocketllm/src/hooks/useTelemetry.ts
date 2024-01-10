// useTelemetry.tsx
import { useCallback } from 'react'

type TelemetryEvent = {
    UserAction: string // e.g., 'click', 'hover', 'input', etc.
    UIComponent: string // 'search button' 'model card', etc.
    UI: string // e.g., 'SelectFileButton', 'SearchBar', etc.
    data?: any // Additional data for the event, e.g., input value, details about the event, etc.
}

export type TelemetryEventPackage = {
    UserName: string // Consistent pseudoname
    timestamp: string
    UserMachine: string
    event: TelemetryEvent
}

function useTelemetry() {
    const recordEvent = useCallback((eventType: TelemetryEvent) => {
        // Here, you can send the data to your server or use Electron's IPC to communicate with the main process.

        const userName = 'PSEUDONAME UNSET'
        const timestamp = new Date().toISOString()
        const osDetails = window.electron.getOSDetails();
        const machineType = `${osDetails.type}-${osDetails.release}-${osDetails.arch}`;

        // const machineType = `${os.type()}-${os.release()}-${os.arch()}`
        
        const telemetryPackage: TelemetryEventPackage = {
            UserName: userName,
            timestamp: timestamp,
            UserMachine: machineType,
            event: eventType
        }

        // Serialize the package
        const serializedData = JSON.stringify(telemetryPackage)
    
        window.electron.send('save-telemetry-data', serializedData)

        // console.log(`Event recorded: ${userName} ${eventType.UserAction} \
        //             in the ${eventType.UI}/${eventType.UIComponent} at ${timestamp} on ${machineType}`)
    }, []);

    return recordEvent;
}

export default useTelemetry;