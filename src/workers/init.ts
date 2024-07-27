import {certificates} from "millegrilles.cryptography";

export type AppWorkers = {
    connection: any,
};

let workers: AppWorkers | null = null;

export type InitWorkersResult = {
    idmg: string,
    ca: string,
    workers: AppWorkers,
}
export async function initWorkers(): Promise<InitWorkersResult> {

    let {idmg, ca} = await loadFiche();

    workers = {
        connection: {}
    };

    return {idmg, ca, workers};
}

export default workers;

type LoadFicheResult = {
    ca: string,
    idmg: string,
}

async function loadFiche(): Promise<LoadFicheResult> {
    let ficheResponse = await fetch('/fiche.json');
    if(ficheResponse.status !== 200) {
        throw new Error(`Loading fiche.json, invalid response (${ficheResponse.status})`)
    }
    let fiche = await ficheResponse.json();

    let content = JSON.parse(fiche['contenu']);
    let {idmg, ca} = content;

    // Verify IDMG with CA
    let idmgVerif = await certificates.getIdmg(ca);
    if(idmgVerif !== idmg) throw new Error("Mismatch IDMG/CA certificate");
    
    console.info("IDMG: ", idmg);

    // Verify the signature.
    let store = new certificates.CertificateStore(ca);
    if(! await store.verifyMessage(fiche)) throw new Error('While loading fiche.json: signature was rejected.');  // Throws Error if invalid

    // Return the content
    return {idmg, ca};
}

export function connect() {

}
