# Alpaca.is - Interactive City Exploration App

## Overview

Alpaca is a mobile-first web application that gamifies tourism experiences through AI-powered, interactive city-specific bingo cards. The platform enables users to explore destinations by completing engaging local activities with intelligent content generation and personalized travel challenges.

Designed for college students and travelers, Alpaca transforms standard tourism into an engaging game where users can:
- Explore activities unique to each city
- Mark items as completed with optional photo uploads
- Navigate between different city bingo cards
- Track progress across multiple destinations

## Architecture Overview

The application follows a modern full-stack architecture:

### Frontend
- React with TypeScript
- Mobile-first responsive design using Tailwind CSS
- Shadcn UI components
- Client-side state management with Zustand
- IndexedDB for local photo storage
- Pre-loading strategy for improved performance

### Backend
- Node.js and Express backend
- PostgreSQL database with Drizzle ORM
- OpenAI integration for content generation
- RESTful API design

## Key Features

### Bingo Card Grid
- 5x5 grid layout representing different activities for each city
- Center square features "Arrive in [City]" as a free space
- Square boxes rather than rectangles for consistent mobile display
- Image-focused UI with text details available on click

### Image Generation
- AI-generated images using OpenAI's DALL-E models
- City-specific style guides to ensure thematic consistency
- Square aspect ratio for consistent grid display
- Parallel image generation for improved admin workflows

### User Photo Capture
- Camera integration for capturing activity completion
- Photos stored in IndexedDB and synced with server
- Optional photo taking when marking activities as completed

### Admin Interface
- Dashboard for city content management
- Bulk generation of descriptions and images
- Metadata tracking for content completion
- Image verification and repair tools

## Database Schema

```typescript
// Key database tables with relationships

// Users table - stores user information and client IDs
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique(),
  clientId: text("client_id").unique(),
  currentCity: text("current_city"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Cities table - stores city information and metadata
export const cities = pgTable("cities", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  styleGuide: jsonb("style_guide"),
  userId: integer("user_id").references(() => users.id),
  isCurrentCity: boolean("is_current_city").default(false),
  isDefaultCity: boolean("is_default_city").default(false),
  itemCount: integer("item_count").default(0),
  itemsWithDescriptions: integer("items_with_descriptions").default(0),
  itemsWithImages: integer("items_with_images").default(0),
  itemsWithValidImageFiles: integer("items_with_valid_image_files").default(0),
  lastMetadataUpdate: timestamp("last_metadata_update"),
});

// Bingo items table - stores activities for each city
export const bingoItems = pgTable("bingo_items", {
  id: text("id").primaryKey(),
  cityId: text("city_id").notNull().references(() => cities.id),
  text: text("text").notNull(),
  isCenterSpace: boolean("is_center_space").default(false),
  gridRow: integer("grid_row"),
  gridCol: integer("grid_col"),
  image: text("image"),
  description: text("description"),
});

// User completions table - tracks completed activities
export const userCompletions = pgTable("user_completions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  itemId: text("item_id").notNull().references(() => bingoItems.id),
  cityId: text("city_id").notNull().references(() => cities.id),
  completedAt: timestamp("completed_at").defaultNow(),
  userPhoto: text("user_photo"),
});
```

## Content Generation

### OpenAI Integration

The application leverages OpenAI's GPT and DALL-E models for content creation:

#### Text Generation Prompts

Here's an example of how bingo item descriptions are generated:

```javascript
// Prompt for generating descriptions
`You are an expert travel guide creating content for college students. 
Please write a short, informative description (2-3 sentences) for the activity: 
"${itemText}" in ${cityName}.

Focus on authentic local experiences, historical significance, and cultural context. 
Avoid overly touristy clichés and social media trends. 
Include practical tips and interesting facts that college students would appreciate. 
Keep it concise but engaging.`
```

#### Image Generation Prompts

Images are generated with city-specific style guides:

```javascript
// Prompt for generating images
`Create a high-quality square image of "${itemText}" in ${cityName}. 
Use the "${artStyle}" style (${styleKeywords}). 
Create a professional-quality image with no text, watermarks or borders. 
Emphasize visual clarity and authentic representation. 
Context: ${description}`
```

## Technical Implementation Details

### Image File Management

Images are stored with a consistent naming pattern:
```
{cityId}bingo-{cityId}-{itemId}-{timestamp}-{uuid}.png
```

The system verifies image files during metadata updates by:
1. Reading the image path from the database
2. Checking for file existence in both `/public/images/` and `/public/` directories
3. Updating metadata counts when valid files are found

### User Identification

Users are identified via:
1. Client ID generation on first visit
2. Database storage of client-user mappings
3. Consistent state retrieval based on client identity

### Admin Batch Processing

For efficiency, the application supports batch operations:
1. Parallel image generation (5 images at once)
2. Bulk description generation
3. City metadata updating
4. Image repair and verification

## Troubleshooting

### Image Verification
If image counts in the admin dashboard don't match the actual files:

1. Use the `/api/update-city-metadata` endpoint to refresh metadata
2. Check `public/images/` for correct file storage
3. Verify database paths match actual file locations

### Content Moderation
Content generation may fail if it triggers OpenAI's content filters. For example, activities that reference:

- Nudity or explicit content
- Illegal activities
- Other content against OpenAI's usage policies

In these cases, rephrase the activity descriptions to avoid triggering filters.

## Conclusion

Travel Bingo represents a novel approach to tourism experiences, combining gamification with educational content to create a more engaging travel experience for college students. The application's modular design allows for easy expansion to new cities while maintaining a consistent user experience.

With AI-powered content generation and robust image management, the platform aims to inspire authentic exploration of global destinations through personalized challenges and contextual information.
