import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Project from '@/models/Project';
import { authenticateUser } from '@/lib/auth';

// GET - Retrieve all projects for authenticated user
export async function GET(request) {
  try {
    // Authenticate user
    const authResult = await authenticateUser(request);
    
    if (!authResult.isAuthenticated) {
      return NextResponse.json({ 
        error: 'Authentication required' 
      }, { status: 401 });
    }
    
    await connectDB();
    
    // Only get projects for the authenticated user
    const projects = await Project.find({ userId: authResult.userId })
      .sort({ createdAt: -1 })
      .select('title description status createdAt updatedAt transcription.language transcription.duration')
      .limit(50);
    
    return NextResponse.json({
      success: true,
      projects: projects
    });
    
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch projects: ' + error.message 
    }, { status: 500 });
  }
}

// POST - Create a new project for authenticated user
export async function POST(request) {
  try {
    // Authenticate user
    const authResult = await authenticateUser(request);
    
    if (!authResult.isAuthenticated) {
      return NextResponse.json({ 
        error: 'Authentication required' 
      }, { status: 401 });
    }
    
    await connectDB();
    
    const projectData = await request.json();
    
    // Create new project with user ID
    const project = new Project({
      userId: authResult.userId, // Link project to authenticated user
      title: projectData.title || 'Untitled Project',
      description: projectData.description || '',
      videoFile: projectData.videoFile,
      videoUrl: projectData.videoUrl,
      audioUrl: projectData.audioUrl,
      audioSize: projectData.audioSize,
      transcription: {
        rawText: projectData.transcription?.rawText || '',
        enhancedText: projectData.transcription?.enhancedText || '',
        language: projectData.transcription?.language || 'english',
        duration: projectData.transcription?.duration || 0,
        wordCount: projectData.transcription?.wordCount || 0,
        quality: projectData.transcription?.quality || 'balanced'
      },
      captions: {
        segments: projectData.captions?.segments || [],
        formats: projectData.captions?.formats || {},
        segmentCount: projectData.captions?.segments?.length || 0
      },
      translations: projectData.translations || [],
      status: projectData.status || 'completed',
      processingTime: projectData.processingTime || 0
    });
    
    const savedProject = await project.save();
    
    console.log('Project saved successfully for user:', authResult.userId);
    
    return NextResponse.json({
      success: true,
      project: savedProject,
      message: 'Project saved successfully'
    });
    
  } catch (error) {
    console.error('Error saving project:', error);
    return NextResponse.json({ 
      error: 'Failed to save project: ' + error.message 
    }, { status: 500 });
  }
} 