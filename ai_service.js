const { GoogleGenerativeAI } = require('@google/generative-ai')
const fs = require('fs')
const path = require('path')

class AIService {
  constructor(apiKey) {
    this.apiKey = apiKey
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey)
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    }
  }

  // Method to check if API key is valid
  isApiKeyValid() {
    return !!this.apiKey && this.apiKey.length > 0
  }

  async analyzeImage(imagePath, customPrompt) {
    try {
      if (!this.apiKey) {
        throw new Error('NO_API_KEY')
      }

      // Normalize the path and ensure it exists
      const normalizedPath = path.normalize(imagePath)

      if (!fs.existsSync(normalizedPath)) {
        throw new Error(`Image file not found at path: ${normalizedPath}`)
      }

      // Read the image file
      const imageData = await fs.promises.readFile(normalizedPath)

      // Convert the image to base64
      const imageBase64 = imageData.toString('base64')

      // Create a FileObject for the image
      const imageObject = {
        inlineData: {
          data: imageBase64,
          mimeType: 'image/png',
        },
      }

      // Use custom prompt if provided, otherwise use default
      const prompt =
        customPrompt ||
        `Analyze the coding problem in the screenshot and provide a clear, concise response in the following format:

# Problem Statement
Brief explanation of the problem and its key requirements.

# My Thoughts
- Overview of possible approaches to solve this problem
- Key considerations and constraints
- Edge cases to handle

# Approach 1 (Best Solution)
**Why this is the best:**
- Explain why this approach is optimal
- Key advantages over other approaches

**Implementation:**
\`\`\`language
// Well-commented implementation of the best approach
\`\`\`

**Complexity:**
- Time: O(X) - Brief explanation
- Space: O(Y) - Brief explanation

# Approach 2
**Why consider this:**
- Explain when this approach might be useful
- Trade-offs compared to Approach 1

**Implementation:**
\`\`\`language
// Implementation of second-best approach
\`\`\`

**Complexity:**
- Time: O(X) - Brief explanation
- Space: O(Y) - Brief explanation`

      // Generate content from the image with the prompt
      const result = await this.model.generateContent([imageObject, prompt])
      const response = await result.response
      return response.text()
    } catch (error) {
      console.error('Error in analyzeImage:', error)
      if (error.message.includes('not found')) {
        throw new Error(
          `Screenshot file not found. Please try taking a new screenshot.`
        )
      } else if (error.message.includes('API key')) {
        throw new Error(
          `Invalid or missing API key. Please check your configuration.`
        )
      } else {
        throw new Error(`Failed to analyze image: ${error.message}`)
      }
    }
  }

  // New method to analyze multiple images
  async analyzeMultipleImages(imagePaths, customPrompt) {
    try {
      if (!this.apiKey) {
        throw new Error('NO_API_KEY')
      }

      if (!imagePaths || imagePaths.length === 0) {
        throw new Error('No images provided for analysis')
      }

      // Create array to hold all image objects
      const imageObjects = []

      // Process each image
      for (const imagePath of imagePaths) {
        // Normalize the path and ensure it exists
        const normalizedPath = path.normalize(imagePath)

        if (!fs.existsSync(normalizedPath)) {
          throw new Error(`Image file not found at path: ${normalizedPath}`)
        }

        // Read the image file
        const imageData = await fs.promises.readFile(normalizedPath)

        // Convert the image to base64
        const imageBase64 = imageData.toString('base64')

        // Create a FileObject for the image
        const imageObject = {
          inlineData: {
            data: imageBase64,
            mimeType: 'image/png',
          },
        }

        // Add to array
        imageObjects.push(imageObject)
      }

      // Modify the prompt to handle multiple screenshots
      const basePrompt =
        customPrompt ||
        `Analyze the coding problem shown in the screenshots and provide a clear, concise response in the following format:

# Problem Statement
Brief explanation of the problem and its key requirements.

# My Thoughts
- Overview of possible approaches to solve this problem
- Key considerations and constraints
- Edge cases to handle

# Approach 1 (Best Solution)
**Why this is the best:**
- Explain why this approach is optimal
- Key advantages over other approaches

**Implementation:**
\`\`\`language
// Well-commented implementation of the best approach
\`\`\`

**Complexity:**
- Time: O(X) - Brief explanation
- Space: O(Y) - Brief explanation

# Approach 2
**Why consider this:**
- Explain when this approach might be useful
- Trade-offs compared to Approach 1

**Implementation:**
\`\`\`language
// Implementation of second-best approach
\`\`\`

**Complexity:**
- Time: O(X) - Brief explanation
- Space: O(Y) - Brief explanation`

      // Create the multi-screenshot prompt
      const multiPrompt = `I'm sending you ${imagePaths.length} screenshots of code. These screenshots are connected and show different parts of the same problem or codebase. Please analyze all screenshots together to understand the complete context.\n\n${basePrompt}`

      // Prepare content parts for the API call
      const contentParts = [...imageObjects, multiPrompt]

      // Generate content from the images with the prompt
      const result = await this.model.generateContent(contentParts)
      const response = await result.response
      return response.text()
    } catch (error) {
      console.error('Error in analyzeMultipleImages:', error)
      if (error.message.includes('not found')) {
        throw new Error(
          `One or more screenshot files not found. Please try taking new screenshots.`
        )
      } else if (error.message.includes('API key')) {
        throw new Error(
          `Invalid or missing API key. Please check your configuration.`
        )
      } else {
        throw new Error(`Failed to analyze images: ${error.message}`)
      }
    }
  }
}

module.exports = AIService
