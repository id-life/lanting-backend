/*
  Warnings:

  - You are about to drop the column `archive_filename` on the `archives` table. All the data in the column will be lost.
  - You are about to drop the column `author` on the `archives` table. All the data in the column will be lost.
  - You are about to drop the column `file_type` on the `archives` table. All the data in the column will be lost.
  - You are about to drop the column `original_url` on the `archives` table. All the data in the column will be lost.
  - You are about to drop the column `publisher` on the `archives` table. All the data in the column will be lost.
  - You are about to drop the column `tag` on the `archives` table. All the data in the column will be lost.
  - You are about to alter the column `chapter` on the `archives` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(50)`.
  - You are about to drop the `comments` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `comments` DROP FOREIGN KEY `comments_archive_id_fkey`;

-- AlterTable
ALTER TABLE `archives` DROP COLUMN `archive_filename`,
    DROP COLUMN `author`,
    DROP COLUMN `file_type`,
    DROP COLUMN `original_url`,
    DROP COLUMN `publisher`,
    DROP COLUMN `tag`,
    MODIFY `title` VARCHAR(500) NOT NULL,
    MODIFY `chapter` VARCHAR(50) NOT NULL,
    MODIFY `remarks` MEDIUMTEXT NULL;

-- DropTable
DROP TABLE `comments`;

-- CreateTable
CREATE TABLE `archive_comments` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `nickname` VARCHAR(50) NOT NULL,
    `content` TEXT NOT NULL,
    `archive_id` INTEGER UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `authors` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `authors_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `archive_authors` (
    `archive_id` INTEGER UNSIGNED NOT NULL,
    `author_id` INTEGER UNSIGNED NOT NULL,
    `order` TINYINT UNSIGNED NOT NULL,

    INDEX `archive_authors_archive_id_idx`(`archive_id`),
    INDEX `archive_authors_author_id_idx`(`author_id`),
    PRIMARY KEY (`archive_id`, `author_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `publishers` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(60) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `publishers_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `archive_publishers` (
    `archive_id` INTEGER UNSIGNED NOT NULL,
    `publisher_id` INTEGER UNSIGNED NOT NULL,

    INDEX `archive_publishers_publisher_id_idx`(`publisher_id`),
    PRIMARY KEY (`archive_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tags` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(60) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tags_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `archive_tags` (
    `archive_id` INTEGER UNSIGNED NOT NULL,
    `tag_id` INTEGER UNSIGNED NOT NULL,

    INDEX `archive_tags_archive_id_idx`(`archive_id`),
    INDEX `archive_tags_tag_id_idx`(`tag_id`),
    PRIMARY KEY (`archive_id`, `tag_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `archive_origs` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `archive_id` INTEGER UNSIGNED NOT NULL,
    `original_url` VARCHAR(500) NULL,
    `storage_url` VARCHAR(500) NOT NULL,
    `file_type` VARCHAR(20) NULL,
    `storage_type` VARCHAR(10) NOT NULL DEFAULT 's3',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `archive_origs_archive_id_idx`(`archive_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `archive_comments` ADD CONSTRAINT `archive_comments_archive_id_fkey` FOREIGN KEY (`archive_id`) REFERENCES `archives`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `archive_authors` ADD CONSTRAINT `archive_authors_archive_id_fkey` FOREIGN KEY (`archive_id`) REFERENCES `archives`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `archive_authors` ADD CONSTRAINT `archive_authors_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `authors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `archive_publishers` ADD CONSTRAINT `archive_publishers_archive_id_fkey` FOREIGN KEY (`archive_id`) REFERENCES `archives`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `archive_publishers` ADD CONSTRAINT `archive_publishers_publisher_id_fkey` FOREIGN KEY (`publisher_id`) REFERENCES `publishers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `archive_tags` ADD CONSTRAINT `archive_tags_archive_id_fkey` FOREIGN KEY (`archive_id`) REFERENCES `archives`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `archive_tags` ADD CONSTRAINT `archive_tags_tag_id_fkey` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `archive_origs` ADD CONSTRAINT `archive_origs_archive_id_fkey` FOREIGN KEY (`archive_id`) REFERENCES `archives`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
