import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1790797535550 implements MigrationInterface {
  name = 'InitialSchema1790797535550';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Bestehende Datenbanken wurden früher per `synchronize` angelegt und
    // haben dieses Schema bereits - dann nur als ausgeführt markieren.
    if (await queryRunner.hasTable('user')) {
      return;
    }

    await queryRunner.query(
      `CREATE TABLE "user" ("id" SERIAL NOT NULL, "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "name" character varying(255) NOT NULL, "lastName" character varying(255) NOT NULL, "refreshTokenHash" character varying, "calendarToken" character varying(64), CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "UQ_3315558104a593aeab50490a7f1" UNIQUE ("calendarToken"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "birthdays" ("entryId" uuid NOT NULL DEFAULT gen_random_uuid(), "id" SERIAL NOT NULL, "name" character varying(255) NOT NULL, "lastName" character varying(255) NOT NULL, "dateOfBirth" character varying(10), "Todo" character varying(20) NOT NULL DEFAULT 'NEEDPRESENT', "userId" integer NOT NULL, CONSTRAINT "UQ_f3164467250c1887e9fd4fe6662" UNIQUE ("entryId"), CONSTRAINT "PK_d5cd856d4f7933abc1d9aa16c21" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "birthdays" ADD CONSTRAINT "FK_b6a36bb8d38c85e187ffe774cb8" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "birthdays" DROP CONSTRAINT "FK_b6a36bb8d38c85e187ffe774cb8"`,
    );
    await queryRunner.query(`DROP TABLE "birthdays"`);
    await queryRunner.query(`DROP TABLE "user"`);
  }
}
