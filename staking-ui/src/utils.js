import {
    PublicKey,
} from '@solana/web3.js';
import {
    poolPublicKey,
    mintRewardsPublicKey,
    lpMintPublicKey,
    funderPublicKey,
    programId
} from "./config";

export async function getStakeUserPubkey(walletPubkey) {
    return await PublicKey.findProgramAddress(
        [walletPubkey.toBuffer(), poolPublicKey.toBuffer(), (new TextEncoder().encode('user'))],
        programId
    );
}

export async function getStakeUserStorePubkey(walletPubkey, storeId) {
    return await PublicKey.findProgramAddress(
        [walletPubkey.toBuffer(), poolPublicKey.toBuffer(), (new TextEncoder().encode('user')), [storeId]],
        programId
    );
}

export async function getPoolSigner() {
    return await PublicKey.findProgramAddress(
        [poolPublicKey.toBuffer()],
        programId
    );
}

export async function getVaultPubkey() {
    return await PublicKey.findProgramAddress(
        [funderPublicKey.toBuffer(), poolPublicKey.toBuffer()],
        programId
    );
}