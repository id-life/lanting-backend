-- CreateTable
CREATE TABLE `archives` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `author` VARCHAR(191) NULL,
    `publisher` VARCHAR(191) NULL,
    `date` VARCHAR(191) NULL,
    `chapter` VARCHAR(191) NOT NULL,
    `tag` JSON NULL,
    `remarks` VARCHAR(191) NULL,
    `original_url` VARCHAR(191) NULL,
    `archive_filename` VARCHAR(191) NULL,
    `file_type` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
