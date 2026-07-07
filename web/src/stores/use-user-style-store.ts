"use client";

import { create } from "zustand";

import { deleteAccountStyle, fetchAccountStyles, saveAccountStyle, uploadAccountStyleImage, type UserStyle } from "@/services/api/auth";

type UserStyleStore = {
    styles: UserStyle[];
    isLoading: boolean;
    isSaving: boolean;
    loadedToken: string;
    loadStyles: (token: string, force?: boolean) => Promise<void>;
    saveStyle: (token: string, item: Partial<UserStyle>) => Promise<UserStyle>;
    deleteStyle: (token: string, id: string) => Promise<void>;
    uploadImage: (token: string, file: File) => Promise<string>;
    clearStyles: () => void;
};

export const useUserStyleStore = create<UserStyleStore>((set, get) => ({
    styles: [],
    isLoading: false,
    isSaving: false,
    loadedToken: "",
    loadStyles: async (token, force = false) => {
        if (!token) return set({ styles: [], loadedToken: "" });
        if (!force && get().loadedToken === token) return;
        set({ isLoading: true });
        try {
            set({ styles: await fetchAccountStyles(token), loadedToken: token });
        } finally {
            set({ isLoading: false });
        }
    },
    saveStyle: async (token, item) => {
        set({ isSaving: true });
        try {
            const saved = await saveAccountStyle(token, item);
            set((state) => ({ styles: [saved, ...state.styles.filter((style) => style.id !== saved.id)] }));
            return saved;
        } finally {
            set({ isSaving: false });
        }
    },
    deleteStyle: async (token, id) => {
        await deleteAccountStyle(token, id);
        set((state) => ({ styles: state.styles.filter((style) => style.id !== id) }));
    },
    uploadImage: async (token, file) => (await uploadAccountStyleImage(token, file)).url,
    clearStyles: () => set({ styles: [], loadedToken: "" }),
}));
