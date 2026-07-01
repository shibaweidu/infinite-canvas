import { apiGet, apiPost } from "@/services/api/request";

export const AUTH_TOKEN_KEY = "infinite-canvas-auth-token-v1";

export type UserRole = "guest" | "user" | "admin";

export type AuthUser = {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    role: UserRole;
    credits: number;
    createdAt: string;
    updatedAt: string;
};

export type AuthSession = {
    token: string;
    user: AuthUser;
};

export type AccountCreditLog = {
    id: string;
    userId: string;
    type: string;
    amount: number;
    balance: number;
    relatedId: string;
    remark: string;
    extra: string;
    createdAt: string;
};

export type BillingBenefit = {
    text: string;
    tag: string;
};

export type SubscriptionPlan = {
    id: string;
    name: string;
    description: string;
    price: number;
    originalPrice: number;
    credits: number;
    durationDays: number;
    priceCycle: string;
    buttonText: string;
    creditLabel: string;
    creditRateText: string;
    benefits: BillingBenefit[];
    enabled: boolean;
    sort: number;
    createdAt: string;
    updatedAt: string;
};

export type CreditPackage = {
    id: string;
    name: string;
    description: string;
    price: number;
    originalPrice: number;
    credits: number;
    bonusCredits: number;
    priceCycle: string;
    buttonText: string;
    creditLabel: string;
    creditRateText: string;
    benefits: BillingBenefit[];
    enabled: boolean;
    sort: number;
    createdAt: string;
    updatedAt: string;
};

export type AccountSummary = {
    user: AuthUser;
    plans: SubscriptionPlan[];
    creditPackages: CreditPackage[];
    rechargeRecords: AccountCreditLog[];
    consumeRecords: AccountCreditLog[];
};

export type AuthPayload = {
    username: string;
    email?: string;
    emailCode?: string;
    password: string;
};

export async function login(payload: AuthPayload) {
    return apiPost<AuthSession>("/api/auth/login", payload);
}

export async function register(payload: AuthPayload) {
    return apiPost<AuthSession>("/api/auth/register", payload);
}

export async function sendRegisterEmailCode(email: string) {
    return apiPost<boolean>("/api/auth/email-code", { email });
}

export async function fetchCurrentUser(token?: string) {
    return apiGet<AuthUser>("/api/auth/me", undefined, token);
}

export async function fetchAccountSummary(token: string) {
    return apiGet<AccountSummary>("/api/account/summary", undefined, token);
}
