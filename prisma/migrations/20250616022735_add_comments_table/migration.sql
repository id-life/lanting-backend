-- CreateTable
CREATE TABLE `comments` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `nickname` VARCHAR(50) NOT NULL,
    `content` TEXT NOT NULL,
    `archive_id` INTEGER UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `comments` ADD CONSTRAINT `comments_archive_id_fkey` FOREIGN KEY (`archive_id`) REFERENCES `archives`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
