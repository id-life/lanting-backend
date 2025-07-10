/*
  Warnings:

  - You are about to drop the column `date` on the `archives` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `archives` DROP COLUMN `date`;

-- CreateTable
CREATE TABLE `dates` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `value` VARCHAR(100) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `dates_value_key`(`value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `archive_dates` (
    `archive_id` INTEGER UNSIGNED NOT NULL,
    `date_id` INTEGER UNSIGNED NOT NULL,

    INDEX `archive_dates_date_id_idx`(`date_id`),
    PRIMARY KEY (`archive_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `search_keywords` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `keyword` VARCHAR(256) NOT NULL,
    `search_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `search_keywords_keyword_key`(`keyword`),
    INDEX `search_keywords_search_count_idx`(`search_count` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `archive_dates` ADD CONSTRAINT `archive_dates_archive_id_fkey` FOREIGN KEY (`archive_id`) REFERENCES `archives`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `archive_dates` ADD CONSTRAINT `archive_dates_date_id_fkey` FOREIGN KEY (`date_id`) REFERENCES `dates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
