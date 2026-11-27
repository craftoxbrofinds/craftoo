import { categoryRepository } from "@/repositories/category.repo";
import { logger } from "@/lib/logger";

export type Category = {
    id: string;
    name: string;
    slug: string | null;
    image?: string | null;
    sort_order?: number | null;
};

export const categoryService = {
    async getAll(): Promise<Category[]> {
        try {
            const data = await categoryRepository.getAll();
            return data.data as Category[];
        } catch (error: any) {
            logger.error("Failed to fetch categories", { error });
            throw new Error(error.message || "Unable to fetch categories");
        }
    },
};