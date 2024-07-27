import { Popover } from 'flowbite-react';

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

    let content = (
        <div className='w-m-80 text-sm text-gray-400 border-gray-600 bg-gray-800'>
            <div className="px-3 py-2 border-b rounded-t-lg border-gray-600 bg-gray-700">
                <h3 className="font-semibold text-white">Version information</h3>
            </div>
            <div className="px-3 py-2 text-left">
                <p>Application name: Authentication</p>
                <p>Version: 2024.6.0</p>
                <p>Build date: 2024-07-12 13:48:00 (UTC)</p>
                <p className='break-all'>IDMG: zVzjVXgsqBoPpUkGybtvwyruScSULjQ8TXg2PZ4LvSJBhHA558gfKBs9</p>
            </div>
        </div>
    );

    return (
        <Popover trigger='hover' content={content}>
            <span>V2024.6.0</span>
        </Popover>
    );
}
