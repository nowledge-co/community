import type { WebAPICallResult } from '../../WebClient';
export type UsersSetPhotoResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    profile?: Profile;
    provided?: string;
};
export interface Profile {
    avatar_hash?: string;
    image_1024?: string;
    image_192?: string;
    image_24?: string;
    image_32?: string;
    image_48?: string;
    image_512?: string;
    image_72?: string;
    image_original?: string;
}
//# sourceMappingURL=UsersSetPhotoResponse.d.ts.map