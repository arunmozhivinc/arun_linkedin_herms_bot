import { DynamicModule, Global, Module } from "@nestjs/common";
import { MongooseModule, getModelToken } from "@nestjs/mongoose";
import { User, UserSchema } from "../users/schemas/user.schema";
import { Draft, DraftSchema } from "../drafts/schemas/draft.schema";

@Global()
@Module({})
export class DatabaseModule {
  static forRoot(): DynamicModule {
    const mongoUri = process.env.MONGODB_URI;

    if (mongoUri && mongoUri.trim().length > 0) {
      return {
        module: DatabaseModule,
        imports: [
          MongooseModule.forRoot(mongoUri, {
            dbName: "linkedin_hermes",
            serverSelectionTimeoutMS: 5000,
          }),
          MongooseModule.forFeature([
            { name: User.name, schema: UserSchema },
            { name: Draft.name, schema: DraftSchema },
          ]),
        ],
        exports: [MongooseModule],
      };
    }

    return {
      module: DatabaseModule,
      providers: [
        {
          provide: getModelToken(User.name),
          useValue: null,
        },
        {
          provide: getModelToken(Draft.name),
          useValue: null,
        },
      ],
      exports: [getModelToken(User.name), getModelToken(Draft.name)],
    };
  }
}
