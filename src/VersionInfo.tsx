import { Popover } from 'flowbite-react';
import useConnectionStore from "./connectionStore";

function VersionInfo() {
    return (
        <>
            <div className='pt-8 pb-4'>
                <div className='text-sm'>MilleGrilles Authentication <PopoverVersion/></div>
            </div>
        </>
    );
}

export default VersionInfo;

function PopoverVersion() {

    const idmg = useConnectionStore(state=>state.idmg);
    const version = '2024.6.1';
    const buildDate = '2024-07-12 13:48:00';

    let content = (
        <div className='w-m-80 text-sm text-gray-400 border-gray-600 bg-gray-800'>
            <div className="px-3 py-2 border-b rounded-t-lg border-gray-600 bg-gray-700">
                <h3 className="font-semibold text-white">Version information</h3>
            </div>
            <div className="px-3 py-2 text-left">
                <p>Application name: Authentication</p>
                <p>Version: {version}</p>
                <p>Build date: {buildDate} (UTC)</p>
                <p className='break-all'>IDMG: {idmg}</p>
            </div>
        </div>
    );

    return (
        <Popover trigger='hover' content={content}>
            <span>V{version}</span>
        </Popover>
    );
}
