pipeline {
    agent { label 'x86_64' }

    parameters {
        string(defaultValue: 'master', name: 'BRANCH')
        string(defaultValue: '2026.3', name: 'VERSION')
        string(defaultValue: 'jenkins-maple', name: 'CREDENTIALS_ID')
        string(defaultValue: 'ssh://git.maple.maceroc.com/git/millegrilles.authentication.typescript', name: 'GIT_URL')
        string(defaultValue: 'millegrilles_authentication_typescript', name: 'ARCHIVE_NAME')
    }

    environment {
        VBUILD = "${params.VERSION}.${BUILD_NUMBER}"
        ARCHIVE_NAME = "${params.ARCHIVE_NAME}"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scmGit(branches: [[name: params.BRANCH]], extensions: [], userRemoteConfigs: [[credentialsId: params.CREDENTIALS_ID, url: params.GIT_URL]])
            }
        }

        stage('Build & Package & Deploy') {
            steps {
                sh "make deploy VERSION_FULL=${VBUILD} ARCHIVE_NAME=${ARCHIVE_NAME}"
            }
        }
    }

    post {
        success {
            archiveArtifacts artifacts: 'artifacts/', followSymlinks: false
        }
    }
}
