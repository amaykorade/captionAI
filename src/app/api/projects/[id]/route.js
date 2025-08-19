import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Project from '@/models/Project';
import { authenticateUser } from '@/lib/auth';

// GET - Retrieve a specific project by ID (user must own it)
export async function GET(request, { params }) {
  try {
    // Authenticate user
    const authResult = await authenticateUser(request);
    
    if (!authResult.isAuthenticated) {
      return NextResponse.json({ 
        error: 'Authentication required' 
      }, { status: 401 });
    }
    
    await connectDB();
    
    // Find project and ensure user owns it
    const project = await Project.findOne({
      _id: params.id,
      userId: authResult.userId
    });
    
    if (!project) {
      return NextResponse.json({ 
        error: 'Project not found or access denied' 
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      project: project
    });
    
  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch project: ' + error.message 
    }, { status: 500 });
  }
}

// PUT - Update a project (user must own it)
export async function PUT(request, { params }) {
  try {
    // Authenticate user
    const authResult = await authenticateUser(request);
    
    if (!authResult.isAuthenticated) {
      return NextResponse.json({ 
        error: 'Authentication required' 
      }, { status: 401 });
    }
    
    await connectDB();
    
    const updateData = await request.json();
    
    // Update project and ensure user owns it
    const project = await Project.findOneAndUpdate(
      {
        _id: params.id,
        userId: authResult.userId
      },
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!project) {
      return NextResponse.json({ 
        error: 'Project not found or access denied' 
      }, { status: 404 });
    }
    
    console.log('Project updated successfully for user:', authResult.userId);
    
    return NextResponse.json({
      success: true,
      project: project,
      message: 'Project updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json({ 
      error: 'Failed to update project: ' + error.message 
    }, { status: 500 });
  }
}

// DELETE - Delete a project (user must own it)
export async function DELETE(request, { params }) {
  try {
    // Authenticate user
    const authResult = await authenticateUser(request);
    
    if (!authResult.isAuthenticated) {
      return NextResponse.json({ 
        error: 'Authentication required' 
      }, { status: 401 });
    }
    
    await connectDB();
    
    // Delete project and ensure user owns it
    const project = await Project.findOneAndDelete({
      _id: params.id,
      userId: authResult.userId
    });
    
    if (!project) {
      return NextResponse.json({ 
        error: 'Project not found or access denied' 
      }, { status: 404 });
    }
    
    console.log('Project deleted successfully for user:', authResult.userId);
    
    return NextResponse.json({
      success: true,
      message: 'Project deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json({ 
      error: 'Failed to delete project: ' + error.message 
    }, { status: 500 });
  }
} 