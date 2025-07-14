# lanting-backend

## 数据迁移

### 下载原有的数据

```bash
# 下载 archives.json
npm run download-archives-json

# 下载 search-keywords.json
npm run download-search-keywords
```

在 lanting.wiki 指向新的 [lanting-frontend](https://github.com/id-life/lanting-frontend) 后，原本后端 api 的地址也改变了，所以 `search-keywords.json` 无法再通过原本的 api 下载到，而原本的 `archives.json` 也不会再被更新。所以对应文件使用 `data/` 下的即可。

### 生成数据迁移脚本

```bash
# 生成数据迁移脚本到 `scripts/sql/data_migration.sql`
npm run generate-data-migration
```

### 执行数据迁移脚本

#### 前提条件

确保数据库已经通过 Prisma migration 初始化：

```bash
# 部署 Prisma migrations（生产环境）
npm run prisma migrate deploy

# 或者推送 schema 到数据库（开发环境）
npm run prisma db push
```

#### 执行迁移

由于兰亭要区分`互联网`和`生物`，迁移数据都是`互联网`的，所以需要手动单独执行数据迁移脚本，而`生物`默认是无数据的。

```bash
# 执行数据迁移脚本
npm run execute-data-migration
```
