import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBirthdaySharing1791468715000 implements MigrationInterface {
  name = 'AddBirthdaySharing1791468715000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "birthday_shares" ("id" SERIAL NOT NULL, "ownerId" integer NOT NULL, "recipientId" integer NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "acceptedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_921c9d533e9167a2e7c9951f70b" UNIQUE ("ownerId", "recipientId"), CONSTRAINT "CHK_d61e2986d327dad37d2e27733f" CHECK ("ownerId" <> "recipientId"), CONSTRAINT "PK_eaebebb517f2aa3bf7c37201402" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "birthday_shares" ADD CONSTRAINT "FK_50b48768cd9d6213f8158206fa9" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "birthday_shares" ADD CONSTRAINT "FK_4e7f4f82d2ca5a87e508db915ac" FOREIGN KEY ("recipientId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    // Geteilte Geburtstage bekommen bei Besitzer und Empfänger je eine
    // Todoist-Aufgabe, also muss der User Teil des Schlüssels sein.
    await queryRunner.query(
      `ALTER TABLE "todoist_tasks" DROP CONSTRAINT "UQ_65750cfc1b742112e5ea0316bee"`,
    );
    await queryRunner.query(
      `ALTER TABLE "todoist_tasks" ADD CONSTRAINT "UQ_e2f6efde5202f22d7cb04124dc1" UNIQUE ("userId", "birthdayId", "year")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Schlägt fehl, falls inzwischen mehrere User Aufgaben für denselben
    // Geburtstag und dasselbe Jahr haben.
    await queryRunner.query(
      `ALTER TABLE "todoist_tasks" DROP CONSTRAINT "UQ_e2f6efde5202f22d7cb04124dc1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "todoist_tasks" ADD CONSTRAINT "UQ_65750cfc1b742112e5ea0316bee" UNIQUE ("birthdayId", "year")`,
    );
    await queryRunner.query(
      `ALTER TABLE "birthday_shares" DROP CONSTRAINT "FK_4e7f4f82d2ca5a87e508db915ac"`,
    );
    await queryRunner.query(
      `ALTER TABLE "birthday_shares" DROP CONSTRAINT "FK_50b48768cd9d6213f8158206fa9"`,
    );
    await queryRunner.query(`DROP TABLE "birthday_shares"`);
  }
}
