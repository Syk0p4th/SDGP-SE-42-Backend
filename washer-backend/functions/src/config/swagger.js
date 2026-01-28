/* eslint-disable max-len */
const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Washer Backend API',
      version: '1.0.0',
      description: 'API documentation for Washer application backend services',
      contact: {
        name: 'API Support',
        email: 'support@washxpress.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:5001/washxpress-19b94/us-central1/api',
        description: 'Development server'
      },
      {
        url: 'https://us-central1-washxpress-19b94.cloudfunctions.net/api',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your Firebase JWT token'
        }
      },
      schemas: {
        User: {
          type: 'object',
          required: ['email', 'displayName'],
          properties: {
            uid: {
              type: 'string',
              description: 'User unique identifier'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            displayName: {
              type: 'string',
              description: 'User full name'
            },
            phoneNumber: {
              type: 'string',
              description: 'User phone number'
            },
            role: {
              type: 'string',
              enum: ['customer', 'admin', 'staff'],
              default: 'customer',
              description: 'User role'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation timestamp'
            }
          }
        },
        Booking: {
          type: 'object',
          required: ['userId', 'serviceId', 'date', 'time', 'vehicleType'],
          properties: {
            id: {
              type: 'string',
              description: 'Booking unique identifier'
            },
            userId: {
              type: 'string',
              description: 'User ID who made the booking'
            },
            serviceId: {
              type: 'string',
              description: 'Service ID being booked'
            },
            date: {
              type: 'string',
              format: 'date',
              description: 'Booking date'
            },
            time: {
              type: 'string',
              description: 'Booking time slot'
            },
            status: {
              type: 'string',
              enum: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'],
              default: 'pending',
              description: 'Booking status'
            },
            vehicleType: {
              type: 'string',
              enum: ['sedan', 'suv', 'truck', 'van', 'motorcycle'],
              description: 'Type of vehicle'
            },
            vehicleNumber: {
              type: 'string',
              description: 'Vehicle registration number'
            },
            totalPrice: {
              type: 'number',
              format: 'float',
              description: 'Total price for the service'
            },
            notes: {
              type: 'string',
              description: 'Additional notes or instructions'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Service: {
          type: 'object',
          required: ['name', 'price', 'duration'],
          properties: {
            id: {
              type: 'string',
              description: 'Service unique identifier'
            },
            name: {
              type: 'string',
              description: 'Service name'
            },
            description: {
              type: 'string',
              description: 'Service description'
            },
            price: {
              type: 'number',
              format: 'float',
              description: 'Base price'
            },
            duration: {
              type: 'integer',
              description: 'Service duration in minutes'
            },
            category: {
              type: 'string',
              enum: ['wash', 'detail', 'maintenance', 'special'],
              description: 'Service category'
            },
            isActive: {
              type: 'boolean',
              default: true,
              description: 'Service availability status'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  description: 'Error message'
                },
                code: {
                  type: 'string',
                  description: 'Error code'
                }
              }
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              description: 'Success message'
            }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Access token is missing or invalid',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        },
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: [
    path.join(__dirname, '../routes/*.js'),
    path.join(__dirname, '../docs/*.yaml')
  ]
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
