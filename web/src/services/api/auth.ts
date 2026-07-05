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

export type AccountTaskStatus = "pending" | "running" | "success" | "failed" | "canceled";

export type AccountTaskLink = {
    label: string;
    url: string;
    type: string;
};

export type AccountTaskEvent = {
    time: string;
    title: string;
    description: string;
    status: "wait" | "process" | "finish" | "error" | string;
};

export type AccountTask = {
    id: string;
    type: string;
    typeLabel: string;
    status: AccountTaskStatus;
    statusLabel: string;
    title: string;
    model: string;
    credits: number;
    progress: number;
    createdAt: string;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    queueDurationMs: number;
    runDurationMs: number;
    summary: string;
    error: string;
    timeline?: AccountTaskEvent[];
    resultLinks?: AccountTaskLink[];
};

export type AccountTaskList = {
    items: AccountTask[];
    total: number;
};

export type AccountTaskQuery = {
    keyword?: string;
    status?: string;
    type?: string;
    page?: number;
    pageSize?: number;
};

export type PaymentOrderType = "subscription" | "credit";

export type PaymentOrder = {
    id: string;
    userId: string;
    type: PaymentOrderType;
    itemId: string;
    itemName: string;
    amount: number;
    credits: number;
    bonusCredits: number;
    durationDays: number;
    status: "pending" | "paid" | "closed";
    provider: "epay";
    providerTrade: string;
    paidAt: string;
    createdAt: string;
    updatedAt: string;
};

export type PaymentCreateResult = {
    order: PaymentOrder;
    payUrl: string;
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

export async function fetchAccountTasks(token: string, query: AccountTaskQuery = {}) {
    return apiGet<AccountTaskList>("/api/account/tasks", query, token);
}

export async function fetchAccountTask(token: string, id: string) {
    return apiGet<AccountTask>(`/api/account/tasks/${encodeURIComponent(id)}`, undefined, token);
}

export async function retryAccountTask(token: string, id: string) {
    return apiPost<AccountTask>(`/api/account/tasks/${encodeURIComponent(id)}/retry`, {}, token);
}

export async function cancelAccountTask(token: string, id: string) {
    return apiPost<AccountTask>(`/api/account/tasks/${encodeURIComponent(id)}/cancel`, {}, token);
}

export async function createPaymentOrder(token: string, type: PaymentOrderType, itemId: string) {
    return apiPost<PaymentCreateResult>("/api/payment/orders", { type, itemId }, token);
}
