import { Popover } from 'flowbite-react';
import useConnectionStore from "./connectionStore";
import { useTranslation } from 'react-i18next';

function VersionInfo() {
    let { t } = useTranslation();

    return (
        <>
            <div className='pt-8 pb-4'>
                <div className='text-sm'>{t('title')} <PopoverVersion/></div>
            </div>
        </>
    );
}

export default VersionInfo;

function PopoverVersion() {
    
    let { t } = useTranslation();

    const idmg = useConnectionStore(state=>state.idmg);
    const version = '2024.6.1';
    const buildDate = '2024-07-12 13:48:00';

    let content = (
        <div className='w-m-80 text-sm text-gray-400 border-gray-600 bg-gray-800'>
            <div className="px-3 py-2 border-b rounded-t-lg border-gray-600 bg-gray-700">
                <h3 className="font-semibold text-white">{t('labels.versionInformation')}</h3>
            </div>
            <div className="px-3 py-2 text-left">
                <p>{t('labels.applicationName')} {t('name')}</p>
                <p>{t('labels.applicationVersion')} {version}</p>
                <p>{t('labels.applicationBuildDate')} {buildDate} (UTC)</p>
                <p className='break-all'>{t('labels.applicationIdmg')} {idmg}</p>
            </div>
        </div>
    );

    return (
        <Popover trigger='hover' content={content}>
            <span>V{version}</span>
        </Popover>
    );
}
