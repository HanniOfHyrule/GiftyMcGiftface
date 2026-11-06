import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTodoistIntegration1790800932454 implements MigrationInterface {
  name = 'AddTodoistIntegration1790800932454';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "todoist_tasks" ("id" SERIAL NOT NULL, "birthdayId" integer NOT NULL, "userId" integer NOT NULL, "year" integer NOT NULL, "todoistTaskId" character varying(64) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_65750cfc1b742112e5ea0316bee" UNIQUE ("birthdayId", "year"), CONSTRAINT "PK_bfeb2b59d30a33fc2622c45652f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "todoist_connections" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "accessToken" text NOT NULL, "refreshToken" text, "expiresAt" TIMESTAMP WITH TIME ZONE, "projectId" character varying(64), "presentLeadDays" integer NOT NULL DEFAULT '7', "cardLeadDays" integer NOT NULL DEFAULT '5', "whatsappLeadDays" integer NOT NULL DEFAULT '0', "lastSyncAt" TIMESTAMP WITH TIME ZONE, "lastError" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "REL_3a30dc1c3bbfae920658c9f93a" UNIQUE ("userId"), CONSTRAINT "PK_dc1dc14dfd2d4cd6c51045e7319" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "todoist_tasks" ADD CONSTRAINT "FK_1bca6346a3a8381a6b2e4dabe80" FOREIGN KEY ("birthdayId") REFERENCES "birthdays"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "todoist_connections" ADD CONSTRAINT "FK_3a30dc1c3bbfae920658c9f93a0" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "todoist_connections" DROP CONSTRAINT "FK_3a30dc1c3bbfae920658c9f93a0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "todoist_tasks" DROP CONSTRAINT "FK_1bca6346a3a8381a6b2e4dabe80"`,
    );
    await queryRunner.query(`DROP TABLE "todoist_connections"`);
    await queryRunner.query(`DROP TABLE "todoist_tasks"`);
  }
}
