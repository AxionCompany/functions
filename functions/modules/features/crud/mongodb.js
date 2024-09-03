
import { Validator as SchemaValidator } from "../../connectors/validator.ts";

export default ({ config, db, schemas, Validator }) => {
  const models = {};

  Validator = Validator || SchemaValidator(schemas)

  const createCollections = async (schema, db) => {
    db = await db;
    const collection = db.collection(key);

    for (const field in schema) {
      const type = schema[field];
      if (typeof type === 'string' && type.includes('^')) {
        await collection.createIndex({ [field]: 1 }, { unique: true });
      }
    }
  };


  const populate = (schema, populateKeys,) => {
    // add lookup pipeline for populate options
    const lookup = [];
    let dynamicPopulate = {};
    let from;
    for (const key of populateKeys) {
      let isArray = false;
      let relation = getValueByPath(schema, key);
      if (Array.isArray(relation)) {
        relation = relation[0];
        isArray = true;
      }
      from = relation?.split("->")?.[1];
      const isDynamic = from && from.startsWith('$');
      isDynamic && (from = from.slice(1));
      if (isDynamic) {
        dynamicPopulate[from] = key;
      } else if (from) {
        lookup.push({
          $lookup: {
            from: from.startsWith('$') ? schema[from.slice(1)] : from,
            localField: key,
            foreignField: "_id",
            as: key,
          },
        });
        !isArray && lookup.push({
          $unwind: {
            path: `$${key}`,
            preserveNullAndEmptyArrays: true,
          },
        });
      }
    }
    return { dynamicPopulate, lookup };
  }
  for (const key in schemas) {
    // get the current schema
    const schema = schemas[key];

    // create the collection
    createCollections(schema, db);

    models[key] = {
      create: async (data, options) => {
        db = await db;
        const validatedData = Validator(schema, data, {
          path: `create_input:${key}`,
          clean: false
        });
        const now = new Date();
        let response = await db(key).insertOne({
          ...validatedData,
          createdAt: now,
          updatedAt: now,
        }, options);
        if (response.insertedId) {
          response = await db(key).findOne({
            _id: response.insertedId,
          });
        }
        const validatedResponse = Validator(schema, response, {
          path: `create_output:${key}`,
        });
        return validatedResponse;
      },
      createMany: async (data, options) => {
        db = await db;
        const validatedData = Validator([schema], data, {
          path: `createMany_input:${key}`,
        });
        const response = await db(key).insertMany(
          validatedData,
          options,
        );
        const validatedResponse = Validator([schema], response, {
          path: `createMany_output:${key}`,
        });
        return validatedResponse;
      },
      find: async (query, options) => {

        db = await db;
        const now = Date.now();
        let lookup = [];
        let dynamicPopulate = {}
      
        if (options?.populate) {
          // add lookup pipeline for populate options
          const populateQuery = populate(schema, options.populate)
          lookup = populateQuery.lookup;
          dynamicPopulate = populateQuery.dynamicPopulate;
          delete options.populate;
        }
      
        let projectStage;
        if (options?.project) {
          projectStage = { $project: options.project };
        }
      
        let sortStage;
        if (options?.sort) {
          sortStage = { $sort: options.sort };
        }
      
        const validatedQuery = Validator(schema, query, {
          query: true,
          path: `find_input:${key}`,
        });
      
        let skipStage;
        if (options?.skip) {
          skipStage = { $skip: options.skip };
        }
      
        let limitStage;
        if (options?.limit) {
          limitStage = { $limit: options.limit };
        } else {
          limitStage = { $limit: 100 };
        }
      
        const pipeline = [
          { $match: { ...validatedQuery, ...query._unsafe } },
          ...lookup,
          projectStage,
          sortStage,
          skipStage,
          limitStage,
        ].filter(Boolean)
      
        let responses = await db(key).aggregate(pipeline)?.toArray();
      
        if (responses.length && Object.keys(dynamicPopulate).length) {
          responses = await Promise.all(responses.map(async (response) => {
            const dynamicPopulatedPromises = Object.entries(dynamicPopulate).map(([dynamicKey, path]) =>
              models[response[dynamicKey]].findOne({ _id: response[path] })
                .then(result => ({ key: path, value: result }))
            );
            const dynamicPopulatedResults = await Promise.all(dynamicPopulatedPromises);
            dynamicPopulatedResults.forEach(({ key, value }) => {
              response[key] = value;
            });
            return response;
          }));
        }
        const validatedResponse = Validator([schema], responses, {
          path: `find_output:${key}`,
        });
      
        return validatedResponse;
      },
      findOne: async (query, options) => {

        db = await db;
        let lookup = [];
        let dynamicPopulate = {};

        if (options?.populate) {
          // add lookup pipeline for populate options
          const populateQuery = populate(schema, options.populate)
          lookup = populateQuery.lookup;
          dynamicPopulate = populateQuery.dynamicPopulate;
          delete options.populate;
        }

        let projectStage;
        if (options?.project) {
          projectStage = { $project: options.project };
        }

        let sortStage;
        if (options?.sort) {
          sortStage = { $sort: options.sort };
        }

        const validatedQuery = Validator(schema, query, {
          query: true,
          path: `findOne_input:${key}`,
        });

        const pipeline = [
          { $match: { ...validatedQuery, ...query._unsafe } },
          ...lookup,
          projectStage,
          sortStage,
          { $limit: 1 },
        ].filter(Boolean);

        const now = Date.now();
        let response = await db(key).aggregate(pipeline)?.toArray();
        response = response[0] ? response[0] : null;

        if (response && Object.keys(dynamicPopulate).length) {
          const dynamicPopulatedPromises = Object.entries(dynamicPopulate).map(([dynamicKey, path]) =>
            models[response[dynamicKey]].findOne({ _id: response[path] })
              .then(result => ({ key: path, value: result }))
          );
          const dynamicPopulatedResults = await Promise.all(dynamicPopulatedPromises);
          dynamicPopulatedResults.forEach(({ key, value }) => {
            response[key] = value;
          });
        }

        // validating response
        const validatedResponse = Validator(schema, response, {
          path: `findOne_output:${key}`,
        });

        return validatedResponse;
      },
      update: async (query, data, options) => {
        db = await db;
        const validatedQuery = Validator(schema, query, {
          query: true,
          path: `update_inputQuery:${key}`,
        });
        const validatedData = Validator(schema, data, {
          path: `update_inputData:${key}`,
          query: typeof options?.updateByPath === "undefined" ? true : false
        });

        function getOperators(data) {
          return Object?.keys(data)
            ?.filter(key => key.startsWith("$"))
            ?.reduce((acc, key) => {
              acc[key] = data[key];
              return acc;
            }, {});
        }
        const operators = getOperators(data);

        const response = await db(key).updateOne(validatedQuery, {
          $set: {
            ...validatedData,
            updatedAt: new Date(),
          },
          ...operators,
        }, options);

        const validatedResponse = Validator(schema, response, {
          path: `update_output:${key}`,
        });
        return validatedResponse;
      },
      updateMany: async (query, data, options) => {
        db = await db;
        const validatedQuery = Validator(schema, query, {
          query: true,
          path: `updateMany_inputQuery:${key}`,
        });
        const validatedData = Validator(schema, data, {
          path: `updateMany_inputData:${key}`,
        });
        function getOperators(data) {
          return Object?.keys(data)
            ?.filter(key => key.startsWith("$"))
            ?.reduce((acc, key) => {
              acc[key] = data[key];
              return acc;
            }, {});
        }
        const operators = getOperators(data);

        const response = await db(key).updateMany(validatedQuery, {
          $set: {
            ...validatedData,
            updatedAt: new Date(),
          },
          ...operators,
        }, options);

        const validatedResponse = Validator(schema, response, {
          path: `updateMany_output:${key}`,
        });
        return validatedResponse;
      },
      delete: async (query, options) => {
        db = await db;
        const validatedQuery = Validator(schema, query, {
          query: true,
          path: `delete_input:${key}`,
        });
        const response = await db(key).deleteOne(
          validatedQuery,
          options,
        );
        const validatedResponse = Validator(schema, response, {
          path: `delete_output:${key}`,
        });
        return validatedResponse;
      },
      customQuery: async (queryStatement) => {
        db = await db;
        const response = await db(key).aggregate(queryStatement)?.toArray();
        // const validatedResponse = Validator([schema], response, {
        //   path: `query_output:${key}`,
        // });
        return response;
      },
    };
  }

  return models;
};

function getValueByPath(obj, path) {
  // Split the path into segments for dot notation and ["key"] notation
  const segments = path.match(/[^.\[\]"']+|(?<=\[)"(.*?)(?="\])/g);

  function getValue(current, segmentIndex) {
    if (current === undefined || segmentIndex === segments.length) {
      return current;
    }

    const segment = segments[segmentIndex];
    const next = current[segment];

    if (Array.isArray(next)) {
      // If the current segment is an array, map over it and apply the rest of the path
      return next.map(item => getValue(item, segmentIndex + 1));
    } else {
      // If not an array, continue down the path
      return getValue(next, segmentIndex + 1);
    }
  }

  const value = getValue(obj, 0);

  return value
}